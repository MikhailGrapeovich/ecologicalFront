const BASE_URL = 'https://ecomap.app.vtxhub.com/api/v1'; // Add this line

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
let registerModal;
let registerForm;
let toggleAuthFormButton;

function init() {
    initMap();
    initUI();
    setupEventListeners();
    loadPollutions();
}

function initMap() {
    myMap = new ymaps.Map('map', {
        center: [55.76, 37.64], // Moscow coordinates as default
        zoom: 10
    }, {
        searchControlProvider: 'yandex#search'
    });
}

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
    registerModal = document.getElementById('register-modal');
    registerForm = document.getElementById('register-form');
    toggleAuthFormButton = document.getElementById('toggle-auth-form');
    updateUI();
}

function setupEventListeners() {
    profileLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (getToken()) {
            profilePanel.classList.toggle('hidden');
        } else {
            showAuthModal();
        }
    });

    addButton.addEventListener('click', () => {
        if (getToken()) {
            modal.classList.remove('hidden');
        } else {
            showAuthModal();
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.classList.add('hidden');
        }
    });

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

    myMap.events.add('click', function (e) {
        coords = e.get('coords');
        if (getToken()) {
            modal.classList.remove('hidden');
        } else {
            showAuthModal();
        }
    });

    authForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const login = authForm.login.value;
        const password = authForm.password.value;

        try {
            const response = await fetch(`${BASE_URL}/login/access-token`, { // Use BASE_URL
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

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(registerForm);
        const password = formData.get('password');
        const confirmPassword = formData.get('confirm_password');

        if (password !== confirmPassword) {
            alert('Пароли не совпадают!');
            return;
        }

        const payload = {
            username: formData.get('username'),
            email: formData.get('email'),
            first_name: formData.get('first_name'),
            last_name: formData.get('last_name'),
            age: formData.get('age'),
            password: password,
        };

        try {
            const response = await fetch(`${BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                alert('Регистрация прошла успешно! Теперь вы можете войти.');
                toggleModal(registerModal);
            } else {
                const errorData = await response.json();
                alert(errorData.detail || 'Ошибка регистрации');
            }
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            alert('Ошибка сети или сервера');
        }
    });

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

    // Toggle between login and registration forms
    toggleAuthFormButton.addEventListener('click', () => {
        const authForm = document.getElementById('auth-form');
        const registerForm = document.getElementById('register-form');
        const authModalTitle = document.getElementById('auth-modal-title');

        if (authForm.classList.contains('hidden')) {
            authForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            authModalTitle.textContent = 'Авторизация';
            toggleAuthFormButton.textContent = 'Зарегистрироваться';
        } else {
            authForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            authModalTitle.textContent = 'Регистрация';
            toggleAuthFormButton.textContent = 'Войти';
        }
    });
}

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
    fetch(`${BASE_URL}/pollution/${id}`, { // Use BASE_URL
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('detailed-pollution-type').textContent = data.type;
        document.getElementById('detailed-pollution-type').dataset.id = data.id; // Add this line
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

        // Show or hide join/leave buttons based on user participation
        const joinButton = document.getElementById('join-task-button');
        const leaveButton = document.getElementById('leave-task-button');
        if (data.isUserParticipating) {
            joinButton.classList.add('hidden');
            leaveButton.classList.remove('hidden');
        } else {
            joinButton.classList.remove('hidden');
            leaveButton.classList.add('hidden');
        }

        toggleModal(document.getElementById('detailed-pollution-modal'));
    })
    .catch(error => {
        console.error('Ошибка загрузки данных: ' + error);
        alert('Произошла ошибка при загрузке данных.');
    });
}

function joinTask() {
    const pollutionId = document.getElementById('detailed-pollution-type').dataset.id;
    fetch(`${BASE_URL}/pollution/${pollutionId}/join_performer`, { // Use BASE_URL
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (response.ok) {
            document.getElementById('join-task-button').classList.add('hidden');
            document.getElementById('leave-task-button').classList.remove('hidden');
        } else {
            alert('Ошибка при присоединении к задаче');
        }
    })
    .catch(error => {
        console.error('Ошибка при присоединении к задаче: ' + error);
        alert('Произошла ошибка при присоединении к задаче.');
    });
}

function leaveTask() {
    const pollutionId = document.getElementById('detailed-pollution-type').dataset.id;
    fetch(`${BASE_URL}/pollution/${pollutionId}/leave`, { // Use BASE_URL
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (response.ok) {
            document.getElementById('join-task-button').classList.remove('hidden');
            document.getElementById('leave-task-button').classList.add('hidden');
        } else {
            alert('Ошибка при покидании задачи');
        }
    })
    .catch(error => {
        console.error('Ошибка при покидании задачи: ' + error);
        alert('Произошла ошибка при покидании задачи.');
    });
}

async function saveFormData(formData) {
    const token = getToken();

    const response = await fetch(`${BASE_URL}/pollution`, { // Use BASE_URL
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
    fetch(`${BASE_URL}/pollution`, { // Use BASE_URL
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

const toggleModal = (modal) => {
    modal.classList.toggle('hidden');
};

const getToken = () => localStorage.getItem('authToken');

const setToken = (token) => localStorage.setItem('authToken', token);

const removeToken = () => localStorage.removeItem('authToken');

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

const showAuthModal = () => {
    toggleModal(authModal);
};

const showRegisterModal = () => {
    toggleModal(registerModal);
};

ymaps.ready(init);
