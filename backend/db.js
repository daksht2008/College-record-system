const mysql = require('mysql2');

// Configure database connection
// Make sure to replace 'password123' with your actual MySQL root password if it's different!
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Daksh1003!', // !!! UPDATE THIS IF YOUR MYSQL PASSWORD IS DIFFERENT !!!
    database: 'college_records'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database: ', err.message);
        console.error('Please make sure MySQL is running, the password is correct, and the schema is imported.');
        return;
    }
    console.log('Successfully connected to MySQL database.');
});

// To use promises
module.exports = db.promise();
