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

document.getElementById('spellCheck').addEventListener('click', async () => {
    const text = document.getElementById('editor').value;
    const response = await axios.post('http://localhost:3000/api/spell-check', { text });
    document.getElementById('result').innerHTML = 'Misspelled words: ' + response.data.join(', ');
});
