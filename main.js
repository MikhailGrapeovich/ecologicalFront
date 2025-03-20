let myMap;
let profilePanel;
let addButton;
let modal;
let profileLink;
let pollutionModal;
let pollutionForm;
let authModal;
let authForm;
let coords;
let navLinks;

// Initialize the map and UI elements
function init() {
    initMap();
    initUI();
    setupEventListeners();
    loadPollutions();
}

// Initialize Yandex Map
function initMap() {
    myMap = new ymaps.Map('map', {
        center: [55.76, 37.64], // Moscow coordinates as default
        zoom: 10
    }, {
        searchControlProvider: 'yandex#search'
    });
}

// Initialize UI elements
function initUI() {
    profilePanel = document.getElementById('profile-panel');
    addButton = document.getElementById('add-pollution');
    modal = document.getElementById('pollution-modal');
    profileLink = document.getElementById('profile-link');
    pollutionModal = document.getElementById('pollution-modal');
    pollutionForm = document.getElementById('pollution-form');
    authModal = document.getElementById('auth-modal');
    authForm = document.getElementById('auth-form');
    navLinks = document.querySelector('.nav-links');
    updateUI();
}

// Setup event listeners
function setupEventListeners() {
    // Profile panel toggle
    profileLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (getToken()) {
            profilePanel.classList.toggle('hidden');
        } else {
            showAuthModal();
        }
    });

    // Add pollution point
    addButton.addEventListener('click', () => {
        if (getToken()) {
            modal.classList.remove('hidden');
        } else {
            showAuthModal();
        }
    });

    // Close pollution modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // Close auth modal when clicking outside
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.classList.add('hidden');
        }
    });

    // Handle form submission
    pollutionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        if (!coords) coords = myMap.getCenter();
        formData.append('longitude', coords[1]);
        formData.append('latitude', coords[0]);
        formData.append('points', e.target.points.value);

        try {
            const pollution = await saveFormData(formData);
            addPollutionPoint([pollution.latitude, pollution.longitude], pollution);
            modal.classList.add('hidden');
            e.target.reset();
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
            alert('Произошла ошибка при сохранении данных.');
        }
    });

    // Handle map click
    myMap.events.add('click', function (e) {
        coords = e.get('coords');
        if (getToken()) {
            modal.classList.remove('hidden');
        } else {
            showAuthModal();
        }
    });

    // Handle auth form submission
    authForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const login = authForm.login.value;
        const password = authForm.password.value;

        try {
            const response = await fetch('http://localhost:8001/api/v1/login/access-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    username: login,
                    password: password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                const token = data.access_token;
                setToken(token);
                toggleModal(authModal);
                updateUI();
            } else {
                alert(data.detail || 'Ошибка авторизации');
            }
        } catch (error) {
            console.error('Ошибка авторизации:', error);
            alert('Ошибка сети или сервера');
        }
    });

    // Handle file input change to show image previews
    document.querySelector('input[name="files"]').addEventListener('change', (e) => {
        const files = e.target.files;
        const previewContainer = document.getElementById('image-preview');
        previewContainer.innerHTML = '';
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target.result;
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    });
}

// Add pollution point to map
function addPollutionPoint(coords, data) {
    const placemark = new ymaps.Placemark(coords, {
        balloonContent: `
            <div class="balloon-content" onclick="showDetailedPollution(${data.id})">
                <h3>Тип загрязнения: ${data.type}</h3>
                <p><strong>Очки:</strong> ${data.points}</p>
            </div>
        `
    }, {
        preset: 'islands#redDotIcon'
    });

    myMap.geoObjects.add(placemark);
    coords = null;
}

function showDetailedPollution(id) {
    fetch(`http://localhost:8001/api/v1/pollution/${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('detailed-pollution-type').textContent = data.type;
        document.getElementById('detailed-pollution-description').textContent = data.description;
        document.getElementById('detailed-pollution-points').textContent = data.points;
        
        const difficultyContainer = document.getElementById('detailed-pollution-difficulty');
        difficultyContainer.innerHTML = `
            <span class="bar ${data.difficulty === 'EASY' ? 'green' : data.difficulty === 'MEDIUM' ? 'yellow' : data.difficulty === 'HARD' ? 'red' : ''}"></span>
            <span class="bar ${data.difficulty === 'MEDIUM' ? 'yellow' : data.difficulty === 'HARD' ? 'red' : ''}"></span>
            <span class="bar ${data.difficulty === 'HARD' ? 'red' : ''}"></span>
        `;

        const imagesContainer = document.getElementById('detailed-pollution-images');
        imagesContainer.innerHTML = data.images.map(image => `<img src="${image.url}" alt="Image">`).join('');

        toggleModal(document.getElementById('detailed-pollution-modal'));
    })
    .catch(error => {
        console.error('Ошибка загрузки данных: ' + error);
        alert('Произошла ошибка при загрузке данных.');
    });
}

async function saveFormData(formData) {
    const token = getToken();

    const response = await fetch('http://localhost:8001/api/v1/pollution', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Ошибка сохранения данных: ${response.status}`);
    }

    return await response.json();
}

function loadPollutions() {
    fetch('http://localhost:8001/api/v1/pollution', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(pollutions => {
        showPollutions(pollutions);
    })
    .catch(error => {
        console.error('Ошибка сети: ' + error);
        alert('Произошла ошибка сети.');
    });
}

function showPollutions(pollutions) {
    pollutions.forEach(pollution => {
        addPollutionPoint([pollution.latitude, pollution.longitude], pollution);
    });
}

// Function to toggle modal visibility
const toggleModal = (modal) => {
    modal.classList.toggle('hidden');
};

// Function to get token from localStorage
const getToken = () => localStorage.getItem('authToken');

// Function to set token in localStorage
const setToken = (token) => localStorage.setItem('authToken', token);

// Function to remove token from localStorage
const removeToken = () => localStorage.removeItem('authToken');

// Function to update UI based on authorization
const updateUI = () => {
    const token = getToken();
    if (token) {
        profileLink.textContent = 'Профиль';
        profileLink.removeEventListener('click', showAuthModal);
        profileLink.addEventListener('click', () => {
            profilePanel.classList.toggle('hidden');
        });
        addButton.disabled = false;
    } else {
        profileLink.textContent = 'Войти';
        profileLink.removeEventListener('click', () => {
            profilePanel.classList.toggle('hidden');
        });
        profileLink.addEventListener('click', showAuthModal);
        profilePanel.classList.add('hidden');
        addButton.disabled = true;
    }
};

// Function to show auth modal
const showAuthModal = () => {
    toggleModal(authModal);
};

// Initialize when Yandex Maps API is loaded
ymaps.ready(init);
