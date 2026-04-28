const db = require('./db');
async function run() {
    try {
        await db.execute("ALTER TABLE students ADD COLUMN status ENUM('active', 'archived') DEFAULT 'active'");
        console.log("Column added successfully.");
    } catch(e) {
        if(e.code === 'ER_DUP_FIELDNAME') console.log("Column already exists.");
        else console.error(e);
    }
    process.exit(0);
}
run();
