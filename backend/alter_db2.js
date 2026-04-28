const db = require('./db');
async function alter() {
    try {
        await db.execute("ALTER TABLE students ADD COLUMN rank_no VARCHAR(50)");
        console.log("Table altered successfully with rank_no!");
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
