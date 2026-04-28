const db = require('./db');
async function alter() {
    try {
        await db.execute("ALTER TABLE students ADD COLUMN extra_info JSON");
        console.log("Table altered with extra_info JSON!");
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
