const bcrypt = require('bcrypt');

(async () => {
    try {
        const password = '111';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log('Hashed password:', hashedPassword);

        const isMatch = await bcrypt.compare(password, '$2b$10$3wCy/3SZMnnM9TXyvpEruOWlQU.mcNG7g1it6YyM32HZy4BfGyUhW');
        console.log('Password match:', isMatch); // 應為 true
    } catch (err) {
        console.error('Bcrypt test error:', err);
    }
})();