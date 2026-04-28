const db = require('./db');
async function alter() {
    try {
        await db.execute("ALTER TABLE students ADD COLUMN division VARCHAR(10) DEFAULT 'A'");
        console.log("Table altered successfully!");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("Column already exists.");
        } else {
            console.error(e);
        }
    }
    process.exit(0);
}
alter();
