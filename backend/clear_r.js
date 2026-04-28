const db = require('./db');
async function clear() {
    try {
        await db.execute("DELETE FROM students WHERE division = 'R'");
        console.log("Cleared R division");
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
clear();
