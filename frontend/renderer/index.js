// const axios = require('axios');

// async function checkSpelling(text) {
//     try {
//         const response = await axios.post('http://localhost:3000/api/spell-check', { text });
//         console.log('Misspelled words:', response.data);
//     } catch (error) {
//         console.error('Error:', error);
//     }
// }

// document.getElementById('spellCheck').addEventListener('click', () => {
//     const text = document.getElementById('editor').value;
//     checkSpelling(text);
// });
const axios = require('axios');


const body = document.querySelector('body');
const themeToggle = document.getElementById('theme-toggle'); // Giả sử bạn có một button với id này

themeToggle.addEventListener('click', () => {
    if (body.dataset.theme === 'light') {
        body.dataset.theme = 'dark';
        body.classList.remove('bg-gray-100', 'text-gray-900');
        body.classList.add('bg-gray-800', 'text-gray-100');
    } else {
        body.dataset.theme = 'light';
        body.classList.remove('bg-gray-800', 'text-gray-100');
        body.classList.add('bg-gray-100', 'text-gray-900');
    }
});

document.getElementById('spellCheck').addEventListener('click', async () => {
    const text = document.getElementById('editor').value;
    const response = await axios.post('http://localhost:3000/api/spell-check', { text });
    document.getElementById('result').innerHTML = 'Misspelled words: ' + response.data.join(', ');
});
