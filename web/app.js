const API_BASE = 'http://localhost:3000/api';

// --- AUTHENTICATION ---
function checkAuth(requiredRole) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    if (user.role === 'admin') return;
    if (requiredRole && user.role !== requiredRole) {
        alert('Unauthorized access');
        window.location.href = 'index.html';
    }
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Login Page Logic
if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
    const loginForm = document.getElementById('loginForm');

    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('userId').value.trim();
            const password = document.getElementById('password').value;
            const divGroup = document.getElementById('divisionGroup');
            const divSelect = document.getElementById('loginDivision');
            const alertBox = document.getElementById('loginAlert');
            
            // If division dropdown is visible, include it
            const division = divGroup.style.display !== 'none' ? divSelect.value : '';

            alertBox.style.display = 'none';

            try {
                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, password, division })
                });
                
                const data = await res.json();
                
                if (data.multiple) {
                    // Show division picker
                    divSelect.innerHTML = '';
                    data.divisions.forEach(d => {
                        const opt = document.createElement('option');
                        opt.value = d;
                        opt.text = 'Division ' + d;
                        divSelect.appendChild(opt);
                    });
                    divGroup.style.display = 'block';
                    
                    alertBox.style.display = 'block';
                    alertBox.className = 'alert';
                    alertBox.style.background = 'rgba(99, 102, 241, 0.2)';
                    alertBox.style.borderColor = '#6366f1';
                    alertBox.style.color = '#a5b4fc';
                    alertBox.innerText = 'Multiple matches found. Select your division and sign in again.';
                    return;
                }
                
                if (data.success) {
                    const role = data.role;
                    const userData = { ...data.user, role };
                    localStorage.setItem('user', JSON.stringify(userData));
                    window.location.href = role === 'admin' ? 'admin.html' : 'dashboard.html';
                } else {
                    alertBox.style.display = 'block';
                    alertBox.className = 'alert error';
                    alertBox.style.background = '';
                    alertBox.style.borderColor = '';
                    alertBox.style.color = '';
                    alertBox.innerText = data.message;
                }
            } catch (err) {
                alertBox.style.display = 'block';
                alertBox.className = 'alert error';
                alertBox.innerText = 'Server connection failed';
            }
        });
    }
}


// --- STUDENT DASHBOARD LOGIC ---
async function loadStudentDashboard() {
    let user = JSON.parse(localStorage.getItem('user'));
    
    const urlParams = new URLSearchParams(window.location.search);
    const targetEnrollment = urlParams.get('enrollment');
    let queryEnrollment = user.enrollment_no;
    
    if (user.role === 'admin' && targetEnrollment) {
        queryEnrollment = targetEnrollment;
    }
    
    document.getElementById('studentName').innerText = targetEnrollment ? `Student ${targetEnrollment}` : (user.name || user.display_enrollment || user.enrollment_no);
    document.getElementById('studentEnrollment').innerText = targetEnrollment || user.display_enrollment || user.enrollment_no;

    try {
        // Fetch Profile for extra dynamic info
        const profRes = await fetch(`${API_BASE}/student/profile/${user.enrollment_no}`);
        const profData = await profRes.json();
        if(profData.success && profData.profile) {
            const p = profData.profile;
            document.getElementById('studentName').innerText = p.name || p.enrollment_no;
            
            let profHtml = `
                <div><span style="color: var(--text-muted); font-size: 0.9rem;">Division</span><br><strong style="font-size:1.1rem;">${p.division || '-'}</strong></div>
            `;
            if (p.rank_no) {
                profHtml += `<div><span style="color: var(--text-muted); font-size: 0.9rem;">Rank</span><br><strong style="font-size:1.1rem; color: #fbbf24;">${p.rank_no}</strong></div>`;
            }
            
            if (p.extra_info) {
                try {
                    const extra = typeof p.extra_info === 'string' ? JSON.parse(p.extra_info) : p.extra_info;
                    for (const [k, v] of Object.entries(extra)) {
                        profHtml += `<div><span style="color: var(--text-muted); font-size: 0.9rem;">${k}</span><br><strong style="font-size:1.1rem;">${v}</strong></div>`;
                    }
                } catch(e) {}
            }
            document.getElementById('profileDetails').innerHTML = profHtml;
        }

        // Fetch Attendance
        const attRes = await fetch(`${API_BASE}/student/getAttendance/${user.enrollment_no}`);
        const attData = await attRes.json();
        if(attData.success) {
            document.getElementById('attendancePercent').innerText = `${attData.percentage}%`;
            
            const attTbody = document.getElementById('attendanceTableBody');
            if (attData.attendance.length === 0) {
                attTbody.innerHTML = '<tr><td colspan="3">No records found</td></tr>';
            } else {
                attTbody.innerHTML = attData.attendance.map(a => `
                    <tr>
                        <td>${new Date(a.date).toLocaleDateString()}</td>
                        <td><span class="badge ${a.status==='Present' ? 'badge-success' : 'badge-danger'}">${a.status}</span></td>
                        <td>${a.division || '-'}</td>
                    </tr>
                `).join('');
            }
        }

        // Fetch Marks
        const marksRes = await fetch(`${API_BASE}/student/getMarks/${user.enrollment_no}`);
        const marksData = await marksRes.json();
        if(marksData.success) {
            const marksTbody = document.getElementById('marksTableBody');
            if (marksData.marks.length === 0) {
                marksTbody.innerHTML = '<tr><td colspan="2">No marks uploaded yet</td></tr>';
            } else {
                marksTbody.innerHTML = marksData.marks.map(m => `
                    <tr>
                        <td>${m.subject}</td>
                        <td><strong>${m.marks}</strong></td>
                    </tr>
                `).join('');
            }
        }
    } catch(e) {
        console.error(e);
    }
}

// --- STUDENT FILES LOGIC ---
async function loadStudentFiles() {
    try {
        const res = await fetch(`${API_BASE}/student/getFiles`);
        const data = await res.json();
        const container = document.getElementById('filesContainer');
        
        if (data.success) {
            if (data.files.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted)">No files available.</p>';
            } else {
                container.innerHTML = data.files.map(f => `
                    <div class="file-item">
                        <div>
                            <strong>${f.file_name}</strong><br>
                            <small style="color:var(--text-muted)">Folder: ${f.folder_name}</small>
                        </div>
                        <a href="http://localhost:3000${f.file_url}" target="_blank" class="download-btn">Download</a>
                    </div>
                `).join('');
            }
        }
    } catch (e) {
        console.error(e);
    }
}

// --- ADMIN DASHBOARD LOGIC ---
function setupAdminListeners() {
    const bulkRegForm = document.getElementById('bulkRegForm');
    const uploadForm = document.getElementById('uploadForm');
    const musterForm = document.getElementById('musterForm');

    // Muster File Sync
    if(musterForm) {
        musterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alertBox = document.getElementById('musterAlert');
            alertBox.className = 'alert';
            alertBox.innerText = 'Processing file...';
            alertBox.style.display = 'block';
            
            const formData = new FormData();
            const folderInput = document.getElementById('uploadFolder');
            if (folderInput && folderInput.value) {
                formData.append('academic_year', folderInput.value);
            }
            formData.append('file', document.getElementById('musterFile').files[0]);

            try {
                const res = await fetch(`${API_BASE}/admin/uploadMuster`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                
                if (data.success) {
                    alertBox.className = 'alert success';
                    alertBox.innerText = data.message;
                    musterForm.reset();
                    if(typeof loadMainDirectory === 'function') loadMainDirectory();
                } else {
                    alertBox.className = 'alert error';
                    alertBox.innerText = data.message || 'Sync failed';
                }
            } catch(err) {
                alertBox.className = 'alert error';
                alertBox.innerText = 'Failed to sync file';
            }
        });
    }

    // Bulk Registration
    if(bulkRegForm) {
        bulkRegForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const startStr = document.getElementById('startEnrollment').value;
            const endStr = document.getElementById('endEnrollment').value;
            const startNum = parseInt(startStr, 10);
            const endNum = parseInt(endStr, 10);
            const division = document.getElementById('regDivision').value.toUpperCase();
            const academic_year = document.getElementById('regYear') ? document.getElementById('regYear').value : '';
            const alertBox = document.getElementById('regAlert');
            
            if (startNum > endNum) {
                alertBox.className = 'alert error';
                alertBox.innerText = 'Ending number must be greater than or equal to starting number.';
                return;
            }

            const list = [];
            const padLength = startStr.length;
            for(let i = startNum; i <= endNum; i++) {
                list.push(i.toString().padStart(padLength, '0'));
            }
            
            try {
                const res = await fetch(`${API_BASE}/admin/registerStudents`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enrollments: list, division, academic_year })
                });
                const data = await res.json();
                
                if (data.success) {
                    alertBox.className = 'alert success';
                    alertBox.innerText = `Processed ${data.results.length} students.`;
                    
                    document.getElementById('regResults').style.display = 'block';
                    document.getElementById('regResultsBody').innerHTML = data.results.map(r => `
                        <tr>
                            <td>${r.enrollment_no}</td>
                            <td>${r.password || '-'}</td>
                            <td><span class="badge ${r.status==='Success'?'badge-success':'badge-danger'}">${r.status}</span></td>
                        </tr>
                    `).join('');
                    document.getElementById('startEnrollment').value = '';
                    document.getElementById('endEnrollment').value = '';
                    document.getElementById('regDivision').value = '';
                    if(typeof loadMainDirectory === 'function') loadMainDirectory();
                }
            } catch(err) {
                alertBox.className = 'alert error';
                alertBox.innerText = 'Failed to process request';
            }
        });
    }



    // File Upload
    if(uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alertBox = document.getElementById('uploadAlert');
            
            const formData = new FormData();
            formData.append('folder_name', document.getElementById('folderName').value);
            formData.append('visibility', document.getElementById('visibility').value);
            formData.append('file', document.getElementById('fileInput').files[0]);
            
            const user = JSON.parse(localStorage.getItem('user'));
            formData.append('uploaded_by', user.username);

            try {
                const res = await fetch(`${API_BASE}/admin/uploadFile`, {
                    method: 'POST',
                    body: formData // Fetch sets correct boundary automatically
                });
                const data = await res.json();
                
                if (data.success) {
                    alertBox.className = 'alert success';
                    alertBox.innerText = 'File uploaded successfully!';
                    uploadForm.reset();
                } else {
                    alertBox.className = 'alert error';
                    alertBox.innerText = data.message || 'Upload failed';
                }
            } catch(err) {
                alertBox.className = 'alert error';
                alertBox.innerText = 'Failed to upload file';
            }
        });
    }
}

// Load Main Directory — Unified Folder Tree: Year → Division → Students
async function loadMainDirectory() {
    const container = document.getElementById('mainDirectory');
    if (!container) return;
    
    container.innerHTML = '<p>Loading...</p>';
    
    try {
        const res = await fetch(`${API_BASE}/admin/getAllStudents`);
        const data = await res.json();
        
        if (data.success) {
            window.studentDataForExport = data.students;

            if (data.students.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted)">No students registered yet. Use the registration form above.</p>';
                return;
            }
            
            // Group: Year → Division → Students
            const yearGroups = {};
            data.students.forEach(s => {
                const year = s.archived_year || 'Unassigned';
                const div = s.division || 'Unknown';
                if (!yearGroups[year]) yearGroups[year] = {};
                if (!yearGroups[year][div]) yearGroups[year][div] = [];
                yearGroups[year][div].push(s);
            });
            
            let html = '';
            for (const [year, divisions] of Object.entries(yearGroups)) {
                const totalInYear = Object.values(divisions).reduce((sum, arr) => sum + arr.length, 0);
                const yearId = 'year-' + year.replace(/[^a-zA-Z0-9]/g, '_');
                
                html += `
                <div style="margin-bottom: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px; overflow: hidden;">
                    <div onclick="document.getElementById('${yearId}').style.display = document.getElementById('${yearId}').style.display === 'none' ? 'block' : 'none'" 
                         style="background: rgba(255,255,255,0.05); padding: 1rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;" 
                         onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        <span style="font-weight: bold; font-size: 1.1rem;">📁 ${year}</span>
                        <span class="badge badge-success" style="font-size: 0.8rem;">${totalInYear} Students</span>
                    </div>
                    <div id="${yearId}" style="display: none; padding: 0.5rem 1rem;">`;
                
                for (const [div, students] of Object.entries(divisions)) {
                    const divId = yearId + '-div-' + div;
                    html += `
                    <div style="margin-bottom: 0.5rem; background: rgba(255,255,255,0.02); border-radius: 6px; overflow: hidden;">
                        <div style="padding: 0.7rem 1rem; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #6366f1;">
                            <span onclick="document.getElementById('${divId}').style.display = document.getElementById('${divId}').style.display === 'none' ? 'grid' : 'none'" 
                                  style="font-weight: 600; cursor: pointer; flex: 1;">
                                📂 Division ${div} <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">${students.length} Students</span>
                            </span>
                            <button onclick="openDivisionMarks('${div}')" class="btn" style="padding: 0.3rem 0.8rem; font-size: 0.85rem; width: auto; background: #6366f1;">Enter Marks</button>
                        </div>
                        <div id="${divId}" style="display: none; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.5rem; padding: 0.7rem 1rem;">`;
                    
                    students.forEach(s => {
                        let emailInfo = '';
                        try {
                            const extra = typeof s.extra_info === 'string' ? JSON.parse(s.extra_info || '{}') : (s.extra_info || {});
                            const email = extra['Email'] || extra['email'] || extra['Email ID'] || extra['EMAIL'] || '';
                            if (email) {
                                emailInfo = `<span style="font-size: 0.65rem; color: #60a5fa;">✉ ${email}</span>`;
                            }
                        } catch(e) {}
                        
                        const passLine = emailInfo 
                            ? emailInfo 
                            : `<span style="font-size: 0.7rem; color: #6ee7b7; font-family: monospace;">🔑 ${s.password}</span>`;
                        
                        html += `<div onclick="openStudentModal('${s.enrollment_no}', '${(s.name || '').replace(/'/g, "\\\\'")}')" 
                            style="padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 4px; text-align: center; font-size: 0.85rem; cursor: pointer; transition: all 0.2s ease;" 
                            onmouseover="this.style.background='rgba(255,255,255,0.1)'" 
                            onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                            <strong>${s.display_enrollment || s.enrollment_no}</strong><br>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${s.name}</span><br>
                            ${passLine}
                        </div>`;
                    });
                    
                    html += `</div></div>`;
                }
                
                html += `</div></div>`;
            }
            container.innerHTML = html;
        }
    } catch (e) {
        container.innerHTML = '<p class="alert error">Failed to load students.</p>';
    }
}

// --- Live Clock ---
function startClock() {
    const el = document.getElementById('liveClock');
    if (!el) return;
    function tick() {
        const now = new Date();
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        const s = now.getSeconds().toString().padStart(2, '0');
        el.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} • ${h}:${m}:${s}`;
    }
    tick();
    setInterval(tick, 1000);
}

// --- Auto-estimate Academic Year ---
function getAcademicYear() {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const year = now.getFullYear();
    // Academic year runs June (5) to May (4)
    // June-December: current year → next year
    // January-May: previous year → current year
    if (month >= 5) { // June onwards
        return year + '-' + String(year + 1).slice(2);
    } else {
        return (year - 1) + '-' + String(year).slice(2);
    }
}

function autoFillYear() {
    const regYear = document.getElementById('regYear');
    const uploadFolder = document.getElementById('uploadFolder');
    const ay = getAcademicYear();
    if (regYear && !regYear.value) regYear.value = ay;
    if (uploadFolder && !uploadFolder.value) uploadFolder.value = ay;
}


window.openStudentModal = async function(enrollment_no, name) {
    document.getElementById('studentModal').style.display = 'flex';
    document.getElementById('modalStudentName').innerText = name || enrollment_no;
    document.getElementById('modalEnrollment').innerText = enrollment_no;
    document.getElementById('modalMarksEnrollment').value = enrollment_no;
    document.getElementById('modalAttendance').innerText = 'Loading...';
    document.getElementById('modalMarksList').innerText = 'Loading...';
    document.getElementById('modalMarksAlert').style.display = 'none';
    document.getElementById('modalMarksValue').value = '';

    // Conditionally show password or Email Sent status
    try {
        const res = await fetch(`${API_BASE}/student/profile/${enrollment_no}`);
        const data = await res.json();
        if(data.success && data.profile) {
            const extra = typeof data.profile.extra_info === 'string' ? JSON.parse(data.profile.extra_info || '{}') : (data.profile.extra_info || {});
            const email = extra['Email'] || extra['email'] || extra['Email ID'] || extra['EMAIL'] || '';
            const modalEnrollmentEl = document.getElementById('modalEnrollment');
            if (email) {
                modalEnrollmentEl.innerHTML = `${enrollment_no}<br><span style="color: #60a5fa; font-size: 0.8rem;">✉ Email Detected: ${email} (Password Hidden)</span>`;
            } else {
                modalEnrollmentEl.innerHTML = `${enrollment_no}<br><span style="color: #6ee7b7; font-size: 0.8rem; font-family: monospace;">🔑 Pass: ${data.profile.password}</span>`;
            }
        }
    } catch(e) {}
    
    try {
        const attRes = await fetch(`${API_BASE}/student/getAttendance/${enrollment_no}`);
        const attData = await attRes.json();
        if(attData.success) {
            document.getElementById('modalAttendance').innerText = `${attData.percentage}%`;
        }
    } catch(e) {
        document.getElementById('modalAttendance').innerText = 'Error';
    }

    try {
        const marksRes = await fetch(`${API_BASE}/student/getMarks/${enrollment_no}`);
        const marksData = await marksRes.json();
        if(marksData.success) {
            if(marksData.marks.length === 0) {
                document.getElementById('modalMarksList').innerHTML = '<p style="font-size:0.9rem; color:var(--text-muted)">No marks uploaded yet.</p>';
            } else {
                let mHtml = '<table style="width:100%; font-size:0.9rem; text-align:left;">';
                marksData.marks.forEach(m => {
                    let displayMark = m.marks;
                    if(m.subject === 'Lab Practical' && displayMark.startsWith('[')) {
                        try {
                            const arr = JSON.parse(displayMark);
                            const valid = arr.filter(x => x !== 'N/A' && x !== '');
                            const sum = valid.reduce((acc, val) => acc + (val === 'AB' ? 0 : Number(val)), 0);
                            const avg = valid.length > 0 ? Math.round(sum / valid.length) : 'N/A';
                            displayMark = `Avg: ${avg} <span style="font-size:0.7rem; color:gray">(${valid.length} completed)</span>`;
                        } catch(e){}
                    } else if (m.subject === 'Midsem' && displayMark.startsWith('{')) {
                        try {
                            const obj = JSON.parse(displayMark);
                            displayMark = `<strong>${obj.t30} / 30</strong> <span style="font-size:0.7rem; color:gray">(CO1: ${obj.co1}, CO2: ${obj.co2}, CO3: ${obj.co3})</span>`;
                        } catch(e){}
                    }
                    mHtml += `<tr><td style="padding:0.2rem 0; border-bottom:1px solid rgba(255,255,255,0.1)">${m.subject}</td><td style="padding:0.2rem 0; border-bottom:1px solid rgba(255,255,255,0.1)"><strong>${displayMark}</strong></td></tr>`;
                });
                mHtml += '</table>';
                document.getElementById('modalMarksList').innerHTML = mHtml;
            }
        }
    } catch(e) {
        document.getElementById('modalMarksList').innerText = 'Error';
    }
};

const modalMarksForm = document.getElementById('modalMarksForm');
if (modalMarksForm) {
    modalMarksForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const enrollment_no = document.getElementById('modalMarksEnrollment').value;
        const subject = document.getElementById('modalMarksSubject').value;
        const marks = document.getElementById('modalMarksValue').value;
        const alertBox = document.getElementById('modalMarksAlert');
        
        try {
            const res = await fetch(`${API_BASE}/admin/updateMarks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enrollment_no, subject, marks })
            });
            const data = await res.json();
            
            alertBox.style.display = 'block';
            if (data.success) {
                alertBox.className = 'alert success';
                alertBox.innerText = 'Marks updated!';
                document.getElementById('modalMarksValue').value = '';
                // Refresh marks list
                openStudentModal(enrollment_no, document.getElementById('modalStudentName').innerText);
            } else {
                alertBox.className = 'alert error';
                alertBox.innerText = data.message || 'Update failed';
            }
        } catch(err) {
            alertBox.style.display = 'block';
            alertBox.className = 'alert error';
            alertBox.innerText = 'Failed to update marks';
        }
    });
}

// --- Division Marks Logic ---
let currentDivStudents = [];
let currentDivName = '';

window.openDivisionMarks = async function(div) {
    currentDivName = div;
    document.getElementById('divMarksTitle').innerText = `Division ${div} Marks`;
    document.getElementById('divMarksModal').style.display = 'flex';
    document.getElementById('divMarksAlert').innerText = '';
    
    try {
        const res = await fetch(`${API_BASE}/admin/getStudents`);
        const data = await res.json();
        currentDivStudents = data.students.filter(s => (s.division || 'A') === div);
        
        loadDivisionMarksTable();
    } catch(e) {
        alert("Failed to load division");
    }
}

window.loadDivisionMarksTable = async function() {
    const subject = document.getElementById('divMarksSubject').value;
    const thead = document.getElementById('divMarksThead');
    const tbody = document.getElementById('divMarksTbody');
    
    tbody.innerHTML = '<tr><td colspan="5">Loading marks...</td></tr>';
    
    try {
        const res = await fetch(`${API_BASE}/admin/getMarksByDivision/${currentDivName}`);
        const data = await res.json();
        const marksMap = {}; 
        if(data.success) {
            data.marks.forEach(m => {
                if(m.subject === subject) {
                    marksMap[m.enrollment_no] = m.marks;
                }
            });
        }
        
        if (subject === 'Lab Practical') {
            let h = '<tr><th style="padding: 0.5rem;">Enrollment</th><th style="padding: 0.5rem;">Name</th>';
            for(let i=1; i<=11; i++) h += `<th style="padding: 0.5rem; text-align:center;">P${i}</th>`;
            h += `<th style="padding: 0.5rem; text-align:center;">Avg</th>`;
            h += '</tr>';
            thead.innerHTML = h;
            
            let b = '';
            currentDivStudents.forEach(s => {
                const enr = s.enrollment_no;
                let existing = Array(11).fill('N/A');
                if(marksMap[enr]) {
                    try { existing = JSON.parse(marksMap[enr]); } catch(e){}
                }
                
                // Calculate initial average
                const valid = existing.filter(x => x !== 'N/A' && x !== '');
                const sum = valid.reduce((acc, val) => acc + (val.toUpperCase() === 'AB' ? 0 : Number(val)), 0);
                const avg = valid.length > 0 ? Math.round(sum / valid.length) : 'N/A';
                
                b += `<tr>
                    <td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">${s.display_enrollment || enr}</td>
                    <td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">${s.name || ''}</td>`;
                for(let i=0; i<11; i++) {
                    b += `<td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);"><input type="text" class="form-control prac-input" data-enr="${enr}" data-idx="${i}" value="${existing[i] || 'N/A'}" style="width: 50px; text-align:center; padding: 0.2rem;" oninput="calcPracAvg('${enr}')"></td>`;
                }
                b += `<td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);"><input type="text" class="form-control prac-avg" id="prac-avg-${enr}" value="${avg}" style="width: 50px; text-align:center; padding: 0.2rem; font-weight:bold; background:rgba(255,255,255,0.1);" readonly></td>`;
                b += `</tr>`;
            });
            tbody.innerHTML = b;
        } else if (subject === 'Midsem') {
            let h = '<tr><th style="padding: 0.5rem;">Enrollment</th><th style="padding: 0.5rem;">Name</th>';
            h += '<th style="padding: 0.5rem; text-align:center;">CO1 (11)</th>';
            h += '<th style="padding: 0.5rem; text-align:center;">CO2 (16)</th>';
            h += '<th style="padding: 0.5rem; text-align:center;">CO3 (13)</th>';
            h += '<th style="padding: 0.5rem; text-align:center;">Total (40)</th>';
            h += '<th style="padding: 0.5rem; text-align:center;">Total (30)</th>';
            h += '</tr>';
            thead.innerHTML = h;
            
            let b = '';
            currentDivStudents.forEach(s => {
                const enr = s.enrollment_no;
                let existing = { co1: '', co2: '', co3: '', t40: '', t30: '' };
                if(marksMap[enr]) {
                    try { 
                        const p = JSON.parse(marksMap[enr]);
                        if(p.t30) existing = p;
                        else existing.t30 = marksMap[enr];
                    } catch(e) {
                        existing.t30 = marksMap[enr];
                    }
                }
                b += `<tr>
                    <td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">${s.display_enrollment || enr}</td>
                    <td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">${s.name || ''}</td>
                    <td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);"><input type="text" class="form-control midsem-co1" data-enr="${enr}" value="${existing.co1}" style="width: 50px; text-align:center; padding: 0.2rem;" oninput="calcMidsem('${enr}')"></td>
                    <td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);"><input type="text" class="form-control midsem-co2" data-enr="${enr}" value="${existing.co2}" style="width: 50px; text-align:center; padding: 0.2rem;" oninput="calcMidsem('${enr}')"></td>
                    <td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);"><input type="text" class="form-control midsem-co3" data-enr="${enr}" value="${existing.co3}" style="width: 50px; text-align:center; padding: 0.2rem;" oninput="calcMidsem('${enr}')"></td>
                    <td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);"><input type="text" class="form-control midsem-t40" id="t40-${enr}" value="${existing.t40}" style="width: 50px; text-align:center; padding: 0.2rem; background:rgba(255,255,255,0.1);" readonly></td>
                    <td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);"><input type="text" class="form-control midsem-t30" id="t30-${enr}" value="${existing.t30}" style="width: 50px; text-align:center; padding: 0.2rem; font-weight:bold; background:rgba(255,255,255,0.1);" readonly></td>
                </tr>`;
            });
            tbody.innerHTML = b;
        } else {
            let h = '<tr><th style="padding: 0.5rem;">Enrollment</th><th style="padding: 0.5rem;">Name</th><th style="padding: 0.5rem;">Marks</th></tr>';
            thead.innerHTML = h;
            
            let b = '';
            currentDivStudents.forEach(s => {
                const enr = s.enrollment_no;
                const existing = marksMap[enr] || '';
                b += `<tr>
                    <td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">${s.display_enrollment || enr}</td>
                    <td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">${s.name || ''}</td>
                    <td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);"><input type="text" class="form-control single-input" data-enr="${enr}" value="${existing}" style="width: 100px; padding: 0.2rem;"></td>
                </tr>`;
            });
            tbody.innerHTML = b;
        }
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="5">Error loading marks</td></tr>';
    }
}

window.saveDivisionMarks = async function() {
    const subject = document.getElementById('divMarksSubject').value;
    const alertBox = document.getElementById('divMarksAlert');
    alertBox.innerText = 'Saving...';
    alertBox.style.color = '#fbbf24';
    
    let updates = []; 
    
    if (subject === 'Lab Practical') {
        const map = {};
        document.querySelectorAll('.prac-input').forEach(inp => {
            const enr = inp.getAttribute('data-enr');
            const idx = parseInt(inp.getAttribute('data-idx'));
            if(!map[enr]) map[enr] = Array(11).fill('N/A');
            map[enr][idx] = inp.value.trim() || 'N/A';
        });
        for(const [enr, arr] of Object.entries(map)) {
            updates.push({ enrollment_no: enr, subject, marks: JSON.stringify(arr) });
        }
    } else if (subject === 'Midsem') {
        const rows = document.querySelectorAll('.midsem-co1');
        rows.forEach(inp => {
            const enr = inp.getAttribute('data-enr');
            const co1 = document.querySelector(`.midsem-co1[data-enr="${enr}"]`).value.trim();
            const co2 = document.querySelector(`.midsem-co2[data-enr="${enr}"]`).value.trim();
            const co3 = document.querySelector(`.midsem-co3[data-enr="${enr}"]`).value.trim();
            const t40 = document.getElementById(`t40-${enr}`).value;
            const t30 = document.getElementById(`t30-${enr}`).value;
            
            if (co1 || co2 || co3 || t30) {
                const payload = JSON.stringify({ co1, co2, co3, t40, t30 });
                updates.push({ enrollment_no: enr, subject, marks: payload });
            }
        });
    } else {
        document.querySelectorAll('.single-input').forEach(inp => {
            const val = inp.value.trim();
            if (val !== '') {
                updates.push({ enrollment_no: inp.getAttribute('data-enr'), subject, marks: val });
            }
        });
    }
    
    try {
        const res = await fetch(`${API_BASE}/admin/bulkUpdateMarks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates })
        });
        const data = await res.json();
        if(data.success) {
            alertBox.innerText = 'Saved successfully!';
            alertBox.style.color = '#6ee7b7';
        } else {
            alertBox.innerText = 'Error saving';
            alertBox.style.color = '#ef4444';
        }
    } catch(e) {
        alertBox.innerText = 'Server Error';
        alertBox.style.color = '#ef4444';
    }
}

window.calcMidsem = function(enr) {
    const v1 = document.querySelector(`.midsem-co1[data-enr="${enr}"]`).value.toUpperCase();
    const v2 = document.querySelector(`.midsem-co2[data-enr="${enr}"]`).value.toUpperCase();
    const v3 = document.querySelector(`.midsem-co3[data-enr="${enr}"]`).value.toUpperCase();
    
    if (v1 === 'AB' && v2 === 'AB' && v3 === 'AB') {
        document.getElementById(`t40-${enr}`).value = 'AB';
        document.getElementById(`t30-${enr}`).value = 'AB';
        return;
    }
    
    const co1 = parseFloat(v1) || 0;
    const co2 = parseFloat(v2) || 0;
    const co3 = parseFloat(v3) || 0;
    
    const t40 = co1 + co2 + co3;
    const t30 = Math.round(t40 * 0.75);
    document.getElementById(`t40-${enr}`).value = t40;
    document.getElementById(`t30-${enr}`).value = t30;
};

window.calcPracAvg = function(enr) {
    const inputs = document.querySelectorAll(`.prac-input[data-enr="${enr}"]`);
    let sum = 0;
    let count = 0;
    inputs.forEach(inp => {
        const val = inp.value.trim().toUpperCase();
        if (val !== 'N/A' && val !== '') {
            count++;
            if (val !== 'AB') {
                sum += parseFloat(val) || 0;
            }
        }
    });
    
    const avgField = document.getElementById(`prac-avg-${enr}`);
    if (count > 0) {
        avgField.value = Math.round(sum / count);
    } else {
        avgField.value = 'N/A';
    }
};

// --- Material Upload Logic ---
let currentFolderPath = [];

window.setUploadTab = function(type) {
    document.getElementById('uploadType').value = type;
    if (type === 'file') {
        document.getElementById('fileSection').style.display = 'block';
        document.getElementById('linkSection').style.display = 'none';
        document.getElementById('tabFileBtn').style.background = 'var(--primary)';
        document.getElementById('tabLinkBtn').style.background = 'transparent';
    } else {
        document.getElementById('fileSection').style.display = 'none';
        document.getElementById('linkSection').style.display = 'block';
        document.getElementById('tabFileBtn').style.background = 'transparent';
        document.getElementById('tabLinkBtn').style.background = 'var(--primary)';
    }
}

function updateBreadcrumb() {
    const bc = document.getElementById('folderBreadcrumb');
    const pathInput = document.getElementById('materialFolderPath');
    let html = '<span style="color: #6ee7b7; cursor: pointer;" onclick="resetFolderPath()">📁 Root</span>';
    currentFolderPath.forEach((folder, idx) => {
        html += ` <span style="color: var(--text-muted);">›</span> <span style="color: #60a5fa; cursor: pointer;" onclick="goToPathLevel(${idx})">${folder}</span>`;
    });
    bc.innerHTML = html;
    pathInput.value = currentFolderPath.join('/');
}

window.resetFolderPath = function() {
    currentFolderPath = [];
    updateBreadcrumb();
    document.getElementById('materialFolder').value = '';
}

window.goToPathLevel = function(idx) {
    currentFolderPath = currentFolderPath.slice(0, idx + 1);
    updateBreadcrumb();
}

window.navigateToFolder = function() {
    const sel = document.getElementById('materialFolder');
    const val = sel.value;
    if (!val) return;
    currentFolderPath = [val];
    updateBreadcrumb();
    sel.value = '';
}

window.createNewFolder = function() {
    const fn = prompt("Enter new folder name:");
    if (fn) {
        const sel = document.getElementById('materialFolder');
        // Check if already exists
        const exists = Array.from(sel.options).some(o => o.value === fn);
        if (!exists) {
            const opt = document.createElement('option');
            opt.value = fn;
            opt.text = fn;
            sel.add(opt);
        }
        currentFolderPath = [fn];
        updateBreadcrumb();
        sel.value = '';
    }
}

window.addSubfolder = function() {
    if (currentFolderPath.length === 0) {
        alert('Pick or create a parent folder first.');
        return;
    }
    const sub = prompt(`Create subfolder inside "${currentFolderPath.join('/')}":`);
    if (sub) {
        currentFolderPath.push(sub);
        updateBreadcrumb();
    }
}

const materialForm = document.getElementById('materialForm');
if(materialForm) {
    materialForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertBox = document.getElementById('uploadAlert');
        const formData = new FormData();
        
        formData.append('folder_name', document.getElementById('materialFolderPath').value || document.getElementById('materialFolder').value || 'root');
        formData.append('visibility', document.getElementById('materialVisibility').value);
        
        const type = document.getElementById('uploadType').value;
        if (type === 'file') {
            const f = document.getElementById('materialFile').files[0];
            if(!f) return alert('Please select a file');
            formData.append('file', f);
        } else {
            const l = document.getElementById('materialLink').value;
            if(!l) return alert('Please enter a link');
            formData.append('link_url', l);
        }
        
        const user = JSON.parse(localStorage.getItem('user'));
        if(user) formData.append('uploaded_by', user.username || user.enrollment_no);
        
        try {
            const res = await fetch(`${API_BASE}/admin/uploadFile`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            alertBox.style.display = 'block';
            if (data.success) {
                alertBox.className = 'alert success';
                alertBox.innerText = 'Material added!';
                materialForm.reset();
            } else {
                alertBox.className = 'alert error';
                alertBox.innerText = data.message || 'Failed to upload';
            }
        } catch(err) {
            alertBox.style.display = 'block';
            alertBox.className = 'alert error';
            alertBox.innerText = 'Failed to process request';
        }
    });
}
