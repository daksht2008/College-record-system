const APP_ORIGIN = (window.location.protocol === 'file:' || window.location.origin === 'null')
    ? 'http://localhost:3000'
    : window.location.origin;
const API_BASE = APP_ORIGIN + '/api';
const SESSION_KEY = 'eduSyncSession';
const PERSIST_KEY = 'eduSyncRemember';

function normalizeFileUrl(url) {
    if (!url) return '#';
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    if (url.startsWith('//')) {
        return window.location.protocol + url;
    }
    if (!url.startsWith('/')) {
        return APP_ORIGIN + '/' + url;
    }
    return APP_ORIGIN + url;
}

window.showAppModal = function(title, message, type = 'alert', callback = null) {
    let overlay = document.getElementById('appModalOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'appModalOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:none;justify-content:center;align-items:center;backdrop-filter:blur(5px);';
        document.body.appendChild(overlay);
    }
    
    let inputHtml = type === 'prompt' ? `<input type="text" id="appModalInput" class="form-control" style="margin-top:1rem;margin-bottom:1rem;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;width:100%;padding:0.8rem;border-radius:8px;" autofocus autocomplete="off">` : '';
    
    overlay.innerHTML = `
        <div class="glass-card" style="width:90%;max-width:400px;background:#171717;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:1.5rem;box-shadow:0 10px 25px rgba(0,0,0,0.5);animation:slideIn 0.2s;">
            <h3 style="margin-bottom:0.5rem;color:white;font-size:1.2rem;">${title}</h3>
            <p style="color:#a1a1aa;font-size:0.95rem;white-space:pre-wrap;line-height:1.4;">${message}</p>
            ${inputHtml}
            <div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;">
                ${(type === 'prompt' || type === 'confirm') ? `<button class="btn" id="appModalCancelBtn" style="background:transparent;border:1px solid #52525b;color:#a1a1aa;width:auto;padding:0.5rem 1rem;">Cancel</button>` : ''}
                <button class="btn" id="appModalOkBtn" style="width:auto;padding:0.5rem 1.5rem;background:#10b981;">OK</button>
            </div>
        </div>
    `;
    
    overlay.style.display = 'flex';
    
    const close = (val) => {
        overlay.style.display = 'none';
        if (callback) callback(val);
    };
    
    document.getElementById('appModalOkBtn').onclick = () => {
        const val = type === 'prompt' ? document.getElementById('appModalInput').value.trim() : true;
        close(val);
    };
    
    if (type === 'prompt' || type === 'confirm') {
        const cancelBtn = document.getElementById('appModalCancelBtn');
        if (cancelBtn) cancelBtn.onclick = () => close(null);
    }
    
    if (type === 'prompt') {
        const inp = document.getElementById('appModalInput');
        setTimeout(() => inp.focus(), 100);
        inp.onkeyup = (e) => { if (e.key === 'Enter') document.getElementById('appModalOkBtn').click(); };
    }
};


function getSavedUser() {
    const sessionData = window.sessionStorage.getItem(SESSION_KEY);
    if (sessionData) {
        try {
            const parsed = JSON.parse(sessionData);
            if (parsed.expires > Date.now()) return parsed.user;
            window.sessionStorage.removeItem(SESSION_KEY);
        } catch (e) {
            window.sessionStorage.removeItem(SESSION_KEY);
        }
    }

    const rememberData = window.localStorage.getItem(PERSIST_KEY);
    if (rememberData) {
        try {
            const parsed = JSON.parse(rememberData);
            if (parsed.expires > Date.now()) return parsed.user;
            window.localStorage.removeItem(PERSIST_KEY);
        } catch (e) {
            window.localStorage.removeItem(PERSIST_KEY);
        }
    }

    return null;
}

function saveUserSession(user, remember) {
    const expires = Date.now() + (remember ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000);
    const payload = JSON.stringify({ user, expires });
    if (remember) {
        window.localStorage.setItem(PERSIST_KEY, payload);
        window.sessionStorage.removeItem(SESSION_KEY);
    } else {
        window.sessionStorage.setItem(SESSION_KEY, payload);
        window.localStorage.removeItem(PERSIST_KEY);
    }
}

function clearUserSession() {
    window.localStorage.removeItem(PERSIST_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
}

function checkAuth(requiredRole) {
    const user = getSavedUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    if (requiredRole && user.role !== requiredRole) {
        showAppModal('Access Denied', 'Unauthorized access', 'alert', () => {
            window.location.href = 'index.html';
        });
        return;
    }
}

function logout() {
    clearUserSession();
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
                    const remember = document.getElementById('loginRememberMe')?.checked;
                    saveUserSession(userData, !!remember);
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

    // Forgot Password Logic
    window.showForgotPasswordModal = function() {
        document.getElementById('forgotPasswordAlert').style.display = 'none';
        document.getElementById('forgotPasswordId').value = '';
        document.getElementById('forgotPasswordModal').style.display = 'flex';
    };

    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('forgotPasswordId').value.trim();
            const alertBox = document.getElementById('forgotPasswordAlert');
            
            alertBox.style.display = 'block';
            alertBox.className = 'alert';
            alertBox.innerText = 'Sending request...';
            
            try {
                const res = await fetch(`${API_BASE}/auth/forgotPassword`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    alertBox.className = 'alert success';
                    alertBox.innerText = data.message;
                } else {
                    alertBox.className = 'alert error';
                    alertBox.innerText = data.message;
                }
            } catch (err) {
                alertBox.className = 'alert error';
                alertBox.innerText = 'Server connection failed';
            }
        });
    }
}

let deferredInstallPrompt = null;
function isIos() {
    const ua = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
}

function isAndroid() {
    return /android/.test(navigator.userAgent.toLowerCase());
}

function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function setupInstallPrompt() {
    if (isStandalone()) return;

    const installContainer = document.getElementById('installContainer');
    const installBtn = document.getElementById('installAppBtn');
    const installText = document.getElementById('installPromptText');
    if (!installContainer || !installBtn || !installText) return;

    const showInstallBanner = (message, showButton = true) => {
        installText.innerText = message;
        installBtn.style.display = showButton ? 'inline-flex' : 'none';
        installContainer.style.display = 'block';
    };

    const defaultMessage = isIos()
        ? 'Open Safari, tap Share, then choose Add to Home Screen to install EduSync.'
        : 'Open your browser menu and choose Add to Home screen to install EduSync.';

    showInstallBanner(defaultMessage, !isIos());

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        const promptText = isAndroid()
            ? 'Tap Install to add EduSync to your home screen.'
            : 'Install EduSync on your device for faster access.';
        showInstallBanner(promptText, true);
    });

    installBtn.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const choice = await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            installBtn.style.display = 'none';
            installText.innerText = choice.outcome === 'accepted'
                ? 'Installed! You can now open EduSync from your home screen.'
                : 'You can install EduSync anytime from your browser menu.';
            console.log('PWA install choice:', choice.outcome);
            return;
        }

        if (isIos()) {
            showInstallBanner('In Safari, tap Share and choose Add to Home Screen.', false);
            return;
        }

        showInstallBanner('Use your browser menu and select Add to Home screen.', false);
    });

    window.addEventListener('appinstalled', () => {
        installText.innerText = 'EduSync was added to your home screen.';
        installBtn.style.display = 'none';
    });
}


// --- STUDENT DASHBOARD LOGIC ---
async function loadStudentDashboard() {
    let user = getSavedUser();
    
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
                        if (!isNaN(k)) continue; // skip numeric keys like '24'
                        if (String(k).toLowerCase() === 'password') continue;
                        profHtml += `<div><span style="color: var(--text-muted); font-size: 0.9rem;">${k}</span><br><strong style="font-size:1.1rem;">${v}</strong></div>`;
                    }
                } catch(e) {}
            }
            document.getElementById('profileDetails').innerHTML = profHtml;
            
            // Check if profile needs completion
            const isGenericName = p.name && p.name.startsWith('Student ');
            let hasEmail = false;
            try {
                const extra = typeof p.extra_info === 'string' ? JSON.parse(p.extra_info) : p.extra_info;
                hasEmail = !!(extra && (extra['Email'] || extra['email'] || extra['Email ID'] || extra['EMAIL']));
            } catch(e) {}
            
            if (isGenericName || !hasEmail) {
                document.getElementById('updateProfileSection').style.display = 'block';
                if (!isGenericName) document.getElementById('updateProfileName').value = p.name;
            }
        }

        // Fetch Attendance
        const attRes = await fetch(`${API_BASE}/student/getAttendance/${user.enrollment_no}`);
        const attData = await attRes.json();
        if (attData.success) {
            const pct = attData.percentage;
            document.getElementById('attendancePercent').innerText = `${pct}%`;

            // Low attendance warning
            const warn = document.getElementById('attLowWarning');
            if (warn) warn.style.display = pct < 75 ? 'block' : 'none';

            // Pie chart
            const pieCtx = document.getElementById('attPieChart');
            if (pieCtx && typeof Chart !== 'undefined') {
                if (window._attPieChart) window._attPieChart.destroy();
                const present = attData.attendance.filter(a => a.status === 'Present').length;
                const absent  = attData.attendance.length - present;
                window._attPieChart = new Chart(pieCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Present', 'Absent'],
                        datasets: [{
                            data: [present, absent],
                            backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(239,68,68,0.65)'],
                            borderColor:     ['rgba(34,197,94,1)',   'rgba(239,68,68,1)'],
                            borderWidth: 2,
                            hoverOffset: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '72%',
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(12,10,9,0.92)',
                                titleColor: '#fafaf9',
                                bodyColor: '#a8a29e',
                                borderColor: 'rgba(244,63,94,0.25)',
                                borderWidth: 1,
                                cornerRadius: 8,
                                padding: 10,
                                callbacks: {
                                    label: ctx => ` ${ctx.label}: ${ctx.parsed} days`
                                }
                            }
                        }
                    }
                });
            }

            // Attendance table — now shows Subject + Type (truncated to 3 rows by default)
            const attTbody = document.getElementById('attendanceTableBody');
            if (attData.attendance.length === 0) {
                attTbody.innerHTML = '<tr><td colspan="5">No records found</td></tr>';
                const toggleContainer = document.getElementById('attTableToggleContainer');
                if (toggleContainer) toggleContainer.style.display = 'none';
            } else {
                attTbody.innerHTML = attData.attendance.map((a, idx) => {
                    const typeLabel = a.type || '-';
                    const subjLabel = a.subject || '-';
                    const typeColor = typeLabel === 'Lab' ? '#fb923c' : typeLabel === 'Tutorial' ? '#a78bfa' : '#60a5fa';
                    const hideStyle = idx >= 3 ? ' style="display: none;" class="att-row-hidden"' : '';
                    return `<tr${hideStyle}>
                        <td>${new Date(a.date).toLocaleDateString()}</td>
                        <td>${subjLabel}</td>
                        <td><span style="padding:0.15rem 0.55rem;border-radius:9999px;font-size:0.78rem;font-weight:700;background:${typeColor}22;color:${typeColor};border:1px solid ${typeColor}44;">${typeLabel}</span></td>
                        <td><span class="badge ${a.status === 'Present' ? 'badge-success' : 'badge-danger'}">${a.status}</span></td>
                        <td>${a.division || '-'}</td>
                    </tr>`;
                }).join('');

                const toggleContainer = document.getElementById('attTableToggleContainer');
                if (toggleContainer) {
                    if (attData.attendance.length > 3) {
                        toggleContainer.style.display = 'block';
                        const toggleBtn = document.getElementById('attTableToggleBtn');
                        const toggleText = document.getElementById('attTableToggleText');
                        const toggleIcon = document.getElementById('attTableToggleIcon');
                        
                        let expanded = false;
                        toggleBtn.onclick = () => {
                            expanded = !expanded;
                            const hiddenRows = document.querySelectorAll('.att-row-hidden');
                            hiddenRows.forEach(row => {
                                row.style.display = expanded ? 'table-row' : 'none';
                            });
                            toggleText.innerText = expanded ? 'Show Less' : 'Show All Records';
                            toggleIcon.innerText = expanded ? '▲' : '▼';
                        };
                    } else {
                        toggleContainer.style.display = 'none';
                    }
                }
            }
        }

        // Fetch Marks
        const marksRes = await fetch(`${API_BASE}/student/getMarks/${user.enrollment_no}`);
        const marksData = await marksRes.json();
        if (marksData.success) {
            if (marksData.marks.length === 0) {
                document.getElementById('marksNoData').style.display = 'block';
                document.getElementById('marksChartContainer').style.display = 'none';
            } else {
                document.getElementById('marksNoData').style.display = 'none';
                document.getElementById('marksChartContainer').style.display = 'block';

                // Store marks globally for drilldown
                window._allMarks = marksData.marks;
                window._marksMode = 'overview'; // 'overview' | 'drilldown'

                showMarksOverview();
                renderSkillRadar();
            }
        }
        
        // Fetch Assignments
        const assignRes = await fetch(`${API_BASE}/student/getAssignments/${user.enrollment_no}`);
        const assignData = await assignRes.json();
        if(assignData.success) {
            const assignTbody = document.getElementById('assignmentsTableBody');
            if (assignData.assignments.length === 0) {
                assignTbody.innerHTML = '<tr><td colspan="3">No assignments submitted yet.</td></tr>';
            } else {
                assignTbody.innerHTML = assignData.assignments.map(a => `
                    <tr>
                        <td>${a.title}</td>
                        <td>${new Date(a.submitted_at).toLocaleString()}</td>
                        <td><a href="${normalizeFileUrl(a.file_url)}" target="_blank" class="download-btn" style="padding:0.2rem 0.5rem;font-size:0.8rem;">View</a></td>
                        <td><strong style="color: var(--primary);">${a.grade || 'Pending'}</strong></td>
                        <td style="font-size: 0.8rem; color: var(--text-muted);">${a.feedback || 'No comments'}</td>
                    </tr>
                `).join('');
            }
        }
    } catch(e) {
        console.error(e);
    }
    
    // Wire up Update Profile Form
    const profileForm = document.getElementById('updateProfileForm');
    if (profileForm && !profileForm.dataset.listener) {
        profileForm.dataset.listener = "true";
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alertBox = document.getElementById('updateProfileAlert');
            const name = document.getElementById('updateProfileName').value;
            const email = document.getElementById('updateProfileEmail').value;
            
            try {
                const res = await fetch(`${API_BASE}/student/updateProfile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enrollment_no: user.enrollment_no, name, email })
                });
                const data = await res.json();
                alertBox.style.display = 'block';
                if (data.success) {
                    alertBox.className = 'alert success';
                    alertBox.innerText = 'Profile updated successfully! Refreshing...';
                    setTimeout(() => location.reload(), 1500);
                } else {
                    alertBox.className = 'alert error';
                    alertBox.innerText = data.message || 'Failed to update profile';
                }
            } catch (err) {
                alertBox.style.display = 'block';
                alertBox.className = 'alert error';
                alertBox.innerText = 'Server error';
            }
        });
    }

    // Wire up Assignment Form
    const assignForm = document.getElementById('assignmentForm');
    if (assignForm && !assignForm.dataset.listener) {
        assignForm.dataset.listener = "true";
        assignForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alertBox = document.getElementById('assignmentAlert');
            const title = document.getElementById('assignmentTitle').value;
            const file = document.getElementById('assignmentFile').files[0];
            
            if (!file) return showAppModal('Error', 'Please select a file.', 'alert');
            
            const formData = new FormData();
            formData.append('enrollment_no', user.enrollment_no);
            formData.append('title', title);
            formData.append('file', file);
            
            alertBox.style.display = 'block';
            alertBox.className = 'alert';
            alertBox.innerText = 'Uploading...';
            
            try {
                const res = await fetch(`${API_BASE}/student/uploadAssignment`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    alertBox.className = 'alert success';
                    alertBox.innerText = 'Assignment submitted successfully!';
                    assignForm.reset();
                    loadStudentDashboard(); // Reload assignments table
                } else {
                    alertBox.className = 'alert error';
                    alertBox.innerText = data.message || 'Failed to submit assignment';
                }
            } catch (err) {
                alertBox.className = 'alert error';
                alertBox.innerText = 'Server error';
            }
        });
    }

    // Setup PWA Web Push notifications and room websocket chats
    if (typeof setupPushNotifications === 'function') setupPushNotifications();
    if (typeof joinStudentChatRoom === 'function') joinStudentChatRoom();
}

// ---- MARKS CHART HELPERS ----
// Overview: Midsem (out of 30) + Internals total (out of 50)
// Drilldown: individual marks per internal subject with % on tooltip

const MIDSEM_MAX = 30;
const INTERNALS_MAX = 50; // Lab Practical(15)+Viva(10)+Project(15)+SelfLearning(10)
const INTERNAL_SUBJECTS_MAX = { 'Lab Practical': 15, 'Viva': 10, 'Project': 15, 'Self Learning': 10 };

function _buildMarksChart(ctx, labels, values, actualValues, maxValues, onClickFn, customBgColors, customBorderColors) {
    if (window._marksChart) window._marksChart.destroy();
    const colors = ['#f43f5e','#fb923c','#eab308','#22c55e','#a855f7','#3b82f6'];
    window._marksChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Percentage',
                data: values,
                backgroundColor: customBgColors || labels.map((_, i) => colors[i % colors.length] + 'b3'),
                borderColor:     customBorderColors || labels.map((_, i) => colors[i % colors.length]),
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0 && onClickFn) onClickFn(elements[0].index);
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(12,10,9,0.92)',
                    titleColor: '#fafaf9',
                    bodyColor: '#a8a29e',
                    borderColor: 'rgba(244,63,94,0.25)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 10,
                    callbacks: {
                        label: function(ctx) {
                            const val = ctx.parsed.y;
                            const actual = actualValues ? actualValues[ctx.dataIndex] : val;
                            const max = maxValues ? maxValues[ctx.dataIndex] : null;
                            return ` Marks: ${actual}${max ? ' / ' + max : ''} (${Math.round(val)}%)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: document.body.classList.contains('light-theme') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)' },
                    ticks: { color: document.body.classList.contains('light-theme') ? '#1c1917' : '#a8a29e', font: { family: 'Inter', size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: document.body.classList.contains('light-theme') ? '#1c1917' : '#a8a29e', font: { family: 'Inter', size: 11, weight: 600 } }
                }
            }
        }
    });
}

window.showMarksOverview = function() {
    const marks = window._allMarks;
    if (!marks || marks.length === 0) return;
    window._marksMode = 'overview';

    // Group by course and track pass/fail components
    const courseGroups = {};
    marks.forEach(m => {
        const c = m.course || 'Physics';
        if (!courseGroups[c]) courseGroups[c] = { total: 0, midsem: 0, internals: 0, max: 80 }; 
        const val = parseFloat(m.marks) || 0;
        courseGroups[c].total += val;
        if (m.subject === 'Midsem') {
            courseGroups[c].midsem += val;
        } else {
            courseGroups[c].internals += val;
        }
    });

    const labels = Object.keys(courseGroups);
    const actualValues = labels.map(c => courseGroups[c].total);
    const maxVals = labels.map(c => courseGroups[c].max);
    const values = actualValues.map((v, i) => (v / maxVals[i]) * 100);
    
    // Check 40% criteria
    const failedSubjects = [];
    const bgColors = [];
    const borderColors = [];
    const colors = ['#f43f5e','#fb923c','#eab308','#22c55e','#a855f7','#3b82f6'];
    
    labels.forEach((c, i) => {
        const cg = courseGroups[c];
        const defaultColor = colors[i % colors.length];
        const midsemFail = cg.midsem < 12; // 40% of 30
        const internalsFail = cg.internals < 20; // 40% of 50
        
        if (midsemFail || internalsFail) {
            let reasons = [];
            if (midsemFail) reasons.push('Midsem');
            if (internalsFail) reasons.push('Internals');
            failedSubjects.push(`${c} (${reasons.join(', ')})`);
            bgColors.push('rgba(239, 68, 68, 0.4)'); // Red with opacity
            borderColors.push('#ef4444'); // Solid red border
        } else {
            bgColors.push(defaultColor + 'b3');
            borderColors.push(defaultColor);
        }
    });

    const ctx = document.getElementById('marksChart');
    if (!ctx) return;

    // Update UI
    const titleEl = document.getElementById('marksCardTitle');
    const backBtn = document.getElementById('marksDrillBackBtn');
    const hintEl  = document.getElementById('marksHint');
    if (titleEl) titleEl.textContent = 'Marks Overview (All Subjects)';
    if (backBtn) backBtn.style.display = 'none';
    if (hintEl)  hintEl.textContent = 'Hover for actual marks · Click a bar to drill down';
    
    const statusEl = document.getElementById('marksStatus');
    if (statusEl) {
        statusEl.style.display = 'block';
        if (failedSubjects.length > 0) {
            statusEl.style.background = 'rgba(239,68,68,0.1)';
            statusEl.style.color = '#f87171';
            statusEl.style.border = '1px solid rgba(239,68,68,0.3)';
            statusEl.innerHTML = `&#x26A0;&#xFE0F; Failing in: ${failedSubjects.join(' · ')}`;
        } else {
            statusEl.style.background = 'rgba(34,197,94,0.1)';
            statusEl.style.color = '#4ade80';
            statusEl.style.border = '1px solid rgba(34,197,94,0.3)';
            statusEl.innerHTML = `&#x2705; Passing all subjects! (>= 40% criteria met)`;
        }
    }

    _buildMarksChart(ctx, labels, values, actualValues, maxVals, (idx) => {
        showMarksDrilldown(labels[idx]); // Drilldown on selected course
    }, bgColors, borderColors);
};

window.showMarksDrilldown = function(courseName) {
    const marks = window._allMarks;
    if (!marks) return;
    window._marksMode = 'drilldown';

    const courseMarks = marks.filter(m => (m.course || 'Physics') === courseName);
    const labels = courseMarks.map(m => m.subject);
    const actualValues = courseMarks.map(m => parseFloat(m.marks) || 0);
    const maxVals = courseMarks.map(m => m.subject === 'Midsem' ? MIDSEM_MAX : (INTERNAL_SUBJECTS_MAX[m.subject] || 15));
    // Values as percentages for Y-axis
    const values = actualValues.map((v, i) => (v / maxVals[i]) * 100);

    const ctx = document.getElementById('marksChart');
    if (!ctx) return;

    const titleEl = document.getElementById('marksCardTitle');
    const backBtn = document.getElementById('marksDrillBackBtn');
    const hintEl  = document.getElementById('marksHint');
    if (titleEl) titleEl.textContent = `${courseName} Marks`;
    if (backBtn) {
        backBtn.style.display = 'inline-block';
        backBtn.onclick = window.showMarksOverview;
    }
    if (hintEl)  hintEl.textContent = 'Hover for actual marks · Click back to return';
    
    // Hide overview status and show specific drilldown pass/fail based on 40%
    const statusEl = document.getElementById('marksStatus');
    if (statusEl) {
        const midsemMark = courseMarks.find(m => m.subject === 'Midsem');
        const internalsTotal = actualValues.filter((_, i) => labels[i] !== 'Midsem').reduce((a,b)=>a+b, 0);
        const midVal = midsemMark ? parseFloat(midsemMark.marks) : 0;
        
        let fails = [];
        if (midVal < 12) fails.push(`Midsem (${midVal}/30)`);
        if (internalsTotal < 20) fails.push(`Internals (${internalsTotal}/50)`);
        
        if (fails.length > 0) {
            statusEl.style.background = 'rgba(239,68,68,0.1)';
            statusEl.style.color = '#f87171';
            statusEl.style.border = '1px solid rgba(239,68,68,0.3)';
            statusEl.innerHTML = `&#x26A0;&#xFE0F; Failed ${courseName}: ${fails.join(' and ')}`;
        } else {
            statusEl.style.background = 'rgba(34,197,94,0.1)';
            statusEl.style.color = '#4ade80';
            statusEl.style.border = '1px solid rgba(34,197,94,0.3)';
            statusEl.innerHTML = `&#x2705; Passed ${courseName}! Midsem: ${midVal}/30, Internals: ${internalsTotal}/50`;
        }
    }

    _buildMarksChart(ctx, labels, values, actualValues, maxVals, null, null, null);
};

window.renderSkillRadar = function() {
    const marks = window._allMarks;
    if (!marks || marks.length === 0) return;
    
    // Group by course to calculate total percentage
    const courseGroups = {};
    marks.forEach(m => {
        const c = m.course || 'Physics';
        if (!courseGroups[c]) courseGroups[c] = { total: 0, max: 80 };
        courseGroups[c].total += parseFloat(m.marks) || 0;
    });

    const labels = Object.keys(courseGroups);
    const percentages = labels.map(c => Math.round((courseGroups[c].total / courseGroups[c].max) * 100));

    const ctx = document.getElementById('radarChart');
    if (!ctx) return;
    
    if (window._radarChart) window._radarChart.destroy();
    
    window._radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Skill Match',
                data: percentages,
                backgroundColor: 'rgba(244, 63, 94, 0.25)', // rose-500 transparent
                borderColor: '#f43f5e',
                pointBackgroundColor: '#fb923c', // orange-400
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#fb923c',
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    angleLines: { color: document.body.classList.contains('light-theme') ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)' },
                    grid: { color: document.body.classList.contains('light-theme') ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' },
                    pointLabels: {
                        color: document.body.classList.contains('light-theme') ? '#1c1917' : '#a8a29e',
                        font: { family: 'Inter', size: 10, weight: 600 }
                    },
                    ticks: {
                        display: false,
                        min: 0,
                        max: 100
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(12,10,9,0.92)',
                    titleColor: '#fafaf9',
                    bodyColor: '#a8a29e',
                    borderColor: 'rgba(244,63,94,0.25)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return ` Mastery: ${context.parsed.r}%`;
                        }
                    }
                }
            }
        }
    });
};

// --- FILE EXPLORER UI LOGIC ---
function buildFileTree(files) {
    const root = { children: {}, files: [] };
    
    files.forEach(f => {
        let folderStr = f.folder_name || 'Uncategorized';
        const parts = folderStr.split(/[/\\]/).filter(p => p.trim() !== '');
        if (parts.length === 0) parts.push('Uncategorized');
        
        let current = root;
        parts.forEach(part => {
            if (!current.children[part]) {
                current.children[part] = { children: {}, files: [] };
            }
            current = current.children[part];
        });
        current.files.push(f);
    });
    
    return root;
}

function countFiles(node) {
    let count = node.files.length;
    for (const child in node.children) {
        count += countFiles(node.children[child]);
    }
    return count;
}

function buildFileTreeHtml(node, pathId, isAdmin) {
    let html = '';
    const childNames = Object.keys(node.children).sort();
    
    childNames.forEach(childName => {
        const childNode = node.children[childName];
        const newPathId = pathId + '-' + childName.replace(/[^a-zA-Z0-9]/g, '_');
        let totalFiles = countFiles(childNode);
        
        html += `
        <div style="margin-bottom: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 8px; overflow: hidden; border-left: 2px solid rgba(255,255,255,0.1);">
            <div onclick="const el = document.getElementById('${newPathId}'); el.style.display = el.style.display === 'none' ? 'block' : 'none'" 
                 style="background: rgba(255,255,255,0.05); padding: 0.75rem 1rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;" 
                 onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                <span style="font-weight: 600; font-size: 1rem;">📁 ${childName}</span>
                <span class="badge badge-success" style="font-size: 0.75rem;">${totalFiles} Files</span>
            </div>
            <div id="${newPathId}" style="display: none; padding: 0.5rem 0.5rem 0.5rem 1rem;">
                ${buildFileTreeHtml(childNode, newPathId, isAdmin)}
            </div>
        </div>
        `;
    });
    
    node.files.forEach(f => {
        html += `
        <div class="file-item" data-name="${f.file_name.replace(/"/g, '&quot;')}" data-tags="${(f.tags || '').replace(/"/g, '&quot;')}" style="background: rgba(255,255,255,0.02); margin-bottom: 0.5rem; padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center; border-radius: 6px; border-left: 2px solid #10b981;">
            <div>
                <strong>${f.file_name}</strong><br>
                <small style="color:var(--text-muted)">${isAdmin ? `${f.visibility} • ` : ''}Uploaded by: ${f.uploaded_by || 'admin'}</small>
                ${f.tags ? `<br><small style="color: var(--primary); font-weight:600; font-size:0.75rem;">${f.tags.split(',').map(t => t.trim()).join(' ')}</small>` : ''}
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <a href="${normalizeFileUrl(f.file_url)}" target="_blank" class="download-btn" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Download</a>
                ${isAdmin ? `<button onclick="deleteFile(${f.id})" style="background: #ef4444; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Delete</button>` : ''}
            </div>
        </div>`;
    });
    
    return html;
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
                const root = buildFileTree(data.files);
                container.innerHTML = buildFileTreeHtml(root, 'student-files', false);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

// --- ADMIN FILES ---
async function loadAdminFiles() {
    try {
        const res = await fetch(`${API_BASE}/admin/getFiles`);
        const data = await res.json();
        const container = document.getElementById('adminFilesContainer');

        if (!container) return;
        if (!data.success || data.files.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted)">No uploaded materials found yet.</p>';
            return;
        }

        const root = buildFileTree(data.files);
        container.innerHTML = buildFileTreeHtml(root, 'admin-files', true);
    } catch (err) {
        const container = document.getElementById('adminFilesContainer');
        if (container) {
            container.innerHTML = '<p class="alert error">Failed to load uploaded files.</p>';
        }
        console.error(err);
    }
}

window.deleteFile = function(id) {
    showAppModal('Delete File', 'Are you sure you want to delete this file? This action cannot be undone.', 'confirm', async (isConfirmed) => {
        if (isConfirmed) {
            try {
                const res = await fetch(`${API_BASE}/admin/deleteFile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                const data = await res.json();
                if (data.success) {
                    loadAdminFiles(); // refresh list
                } else {
                    showAppModal('Error', data.message || 'Failed to delete file', 'alert');
                }
            } catch (err) {
                showAppModal('Error', 'Server error deleting file', 'alert');
            }
        }
    });
};

// --- ADMIN DASHBOARD LOGIC ---
function setupAdminListeners() {
    // Show admin subject
    const user = getSavedUser();
    const subjectLabel = document.getElementById('adminSubjectLabel');
    if (subjectLabel && user) {
        const name = user.name || user.username || 'Admin';
        const subject = user.subject || '';
        subjectLabel.innerHTML = `Logged in as <strong style="color: var(--text-main);">${name}</strong>` + (subject ? ` &mdash; <span style="color: #f43f5e; font-weight: 600;">${subject}</span>` : '');
    }
    
    // Load dynamic divisions for chat room select
    if (typeof loadChatDivisions === 'function') loadChatDivisions();
    
    const bulkRegForm = document.getElementById('bulkRegForm');
    const uploadForm = document.getElementById('uploadForm');
    const musterForm = document.getElementById('musterForm');
    const announcementForm = document.getElementById('announcementForm');

    // Announcement Broadcast
    if (announcementForm) {
        announcementForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alertBox = document.getElementById('announcementAlert');
            const division = document.getElementById('announcementDivision').value;
            const subject = document.getElementById('announcementSubject').value;
            const message = document.getElementById('announcementMessage').value;
            const academic_year = getAcademicYear();
            
            alertBox.style.display = 'block';
            alertBox.className = 'alert';
            alertBox.innerText = 'Sending emails...';
            
            try {
                const res = await fetch(`${API_BASE}/admin/sendAnnouncement`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ division, subject, message, academic_year })
                });
                const data = await res.json();
                if (data.success) {
                    alertBox.className = 'alert success';
                    alertBox.innerText = data.message;
                    announcementForm.reset();
                } else {
                    alertBox.className = 'alert error';
                    alertBox.innerText = data.message || 'Failed to send announcement';
                }
            } catch (err) {
                alertBox.className = 'alert error';
                alertBox.innerText = 'Server error';
            }
        });
    }

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
            
            // Pass the logged-in admin's subject/course so parsed marks are linked to it
            const currentUser = getSavedUser();
            if (currentUser && currentUser.subject) {
                formData.append('course', currentUser.subject);
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
            
            const tagsInput = document.getElementById('materialTags');
            if (tagsInput) {
                formData.append('tags', tagsInput.value.trim());
            }
            
            const user = getSavedUser();
            if (user) {
                formData.append('uploaded_by', user.username || user.enrollment_no);
            }

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

    // Auto-join first division room in Admin chat console
    if (typeof joinAdminChatRoom === 'function' && document.getElementById('chatDivisionSelect')) {
        joinAdminChatRoom();
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
            const uniqueDivisions = new Set();
            const currentYear = getAcademicYear();
            
            data.students.forEach(s => {
                const year = s.archived_year || 'Unassigned';
                const div = s.division || 'Unknown';
                if (!yearGroups[year]) yearGroups[year] = {};
                if (!yearGroups[year][div]) yearGroups[year][div] = [];
                yearGroups[year][div].push(s);
                
                if (year === currentYear || (year === 'Unassigned' && Object.keys(yearGroups).length === 1)) {
                    uniqueDivisions.add(div);
                }
            });
            
            // Populate Announcement Divisions
            const annDivSelect = document.getElementById('announcementDivision');
            if (annDivSelect) {
                annDivSelect.innerHTML = '<option value="ALL">All Divisions (Current Sem)</option>';
                Array.from(uniqueDivisions).sort().forEach(div => {
                    const opt = document.createElement('option');
                    opt.value = div;
                    opt.text = `Division ${div}`;
                    annDivSelect.appendChild(opt);
                });
            }
            
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
                        <div style="padding: 0.7rem 1rem; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #f43f5e;">
                            <span onclick="document.getElementById('${divId}').style.display = document.getElementById('${divId}').style.display === 'none' ? 'grid' : 'none'" 
                                  style="font-weight: 600; cursor: pointer; flex: 1;">
                                📂 Division ${div} <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">${students.length} Students</span>
                            </span>
                            <div style="display: flex; gap: 0.5rem;">
                                <button onclick="openDivisionMarks('${div}')" class="btn" style="padding: 0.3rem 0.8rem; font-size: 0.85rem; width: auto; background: linear-gradient(135deg, #f43f5e, #e11d48);">Enter Marks</button>
                                <button onclick="openDivisionAttendance('${div}')" class="btn" style="padding: 0.3rem 0.8rem; font-size: 0.85rem; width: auto; background: linear-gradient(135deg, #fb923c, #ea580c);">Attendance</button>
                            </div>
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

function setDefaultDate() {
    const dateInput = document.getElementById('attendanceDate');
    if (dateInput) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }
}

// --- ATTENDANCE MARKING SYSTEM ---
let currentAttendanceStudents = [];
let currentAttendanceStatus = {};
let currentAttendanceDivision = '';

async function openDivisionAttendance(division) {
    currentAttendanceDivision = division;
    document.getElementById('attendanceModalTitle').innerText = `Attendance - Division ${division}`;
    document.getElementById('attendanceDateInput').value = new Date().toISOString().split('T')[0];
    document.getElementById('attendanceDivisionInput').value = division;
    
    let defaultStart = '10:30';
    let defaultEnd = '11:30';
    
    // Smart Attendance Time Logic
    try {
        const res = await fetch(`${API_BASE}/admin/getSchedule`);
        const data = await res.json();
        if (data.success) {
            const user = getSavedUser();
            const adminSubject = (user && user.role === 'admin') ? user.subject : '';
            const now = new Date();
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const currentDay = days[now.getDay()];
            const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
            
            // Filter schedules for this division, subject, and day
            let todaysLectures = data.schedules.filter(s => 
                s.day === currentDay && 
                s.division === division && 
                (!adminSubject || s.subject === adminSubject)
            );
            
            if (todaysLectures.length > 0) {
                todaysLectures.sort((a, b) => a.time_slot.localeCompare(b.time_slot));
                
                // Merge continuous lectures
                let mergedLectures = [];
                for (let i = 0; i < todaysLectures.length; i++) {
                    if (mergedLectures.length > 0) {
                        let last = mergedLectures[mergedLectures.length - 1];
                        let lastEnd = last.time_slot.split('-')[1];
                        let currStart = todaysLectures[i].time_slot.split('-')[0];
                        if (lastEnd === currStart && last.subject === todaysLectures[i].subject) {
                            last.time_slot = last.time_slot.split('-')[0] + '-' + todaysLectures[i].time_slot.split('-')[1];
                            continue;
                        }
                    }
                    mergedLectures.push({...todaysLectures[i]});
                }
                
                let selectedLecture = null;
                for (let i = 0; i < mergedLectures.length; i++) {
                    let [start, end] = mergedLectures[i].time_slot.split('-');
                    if (currentTimeStr >= start && currentTimeStr <= end) {
                        selectedLecture = mergedLectures[i];
                        break; // Found ongoing
                    } else if (currentTimeStr > end) {
                        selectedLecture = mergedLectures[i]; // Keep updating to get the closest ended
                    } else if (currentTimeStr < start && !selectedLecture) {
                        selectedLecture = mergedLectures[i];
                        break; // Fallback to first upcoming
                    }
                }
                
                if (selectedLecture) {
                    let [start, end] = selectedLecture.time_slot.split('-');
                    defaultStart = start;
                    defaultEnd = end;
                }
            }
        }
    } catch (e) {
        console.error("Smart attendance time error:", e);
    }

    const startSelect = document.getElementById('attendanceStartTime');
    const endSelect = document.getElementById('attendanceEndTime');
    
    if (startSelect && endSelect) {
        const startOpt = Array.from(startSelect.options).find(o => o.value === defaultStart);
        const endOpt = Array.from(endSelect.options).find(o => o.value === defaultEnd);
        
        if (startOpt) {
            startSelect.value = defaultStart;
            document.getElementById('attendanceCustomStart').value = '';
        } else {
            document.getElementById('attendanceCustomStart').value = defaultStart;
        }
        
        if (endOpt) {
            endSelect.value = defaultEnd;
            document.getElementById('attendanceCustomEnd').value = '';
        } else {
            document.getElementById('attendanceCustomEnd').value = defaultEnd;
        }
    }
    
    document.getElementById('attendanceOnceAlert').style.display = 'none';
    document.getElementById('attendanceModal').style.display = 'flex';
    loadAttendanceList(division);
}

async function loadAttendanceList(division) {
    try {
        const res = await fetch(`${API_BASE}/admin/getAllStudents`);
        const data = await res.json();
        const tbody = document.getElementById('attendanceListBody');
        const alertBox = document.getElementById('attendanceOnceAlert');

        if (!data.success) {
            throw new Error('Failed to load students');
        }

        currentAttendanceStudents = data.students.filter(s => (s.division || 'A') === division);
        currentAttendanceStatus = {};

        if (currentAttendanceStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">No students found for this division.</td></tr>';
            return;
        }

        tbody.innerHTML = currentAttendanceStudents.map(s => {
            currentAttendanceStatus[s.enrollment_no] = false;
            return `
                <tr>
                    <td style="padding: 0.7rem;">${s.display_enrollment || s.enrollment_no}</td>
                    <td style="padding: 0.7rem;">${s.name || 'N/A'}</td>
                    <td style="padding: 0.7rem; text-align: right;">
                        <label class="switch">
                            <input type="checkbox" data-enrollment="${s.enrollment_no}">
                            <span class="slider round"></span>
                        </label>
                    </td>
                </tr>`;
        }).join('');

        document.querySelectorAll('#attendanceListBody input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const enrollment = e.target.getAttribute('data-enrollment');
                currentAttendanceStatus[enrollment] = e.target.checked;
            });
        });

        alertBox.style.display = 'none';
    } catch (err) {
        const alertBox = document.getElementById('attendanceOnceAlert');
        alertBox.style.display = 'block';
        alertBox.className = 'alert error';
        alertBox.innerText = err.message || 'Failed to load attendance list';
        console.error(err);
    }
}

function closeAttendanceModal() {
    document.getElementById('attendanceModal').style.display = 'none';
}

function getAttendanceTime() {
    const start = document.getElementById('attendanceCustomStart').value.trim() || document.getElementById('attendanceStartTime').value;
    const end = document.getElementById('attendanceCustomEnd').value.trim() || document.getElementById('attendanceEndTime').value;
    return { start, end };
}

function setAttendanceAll(present) {
    document.querySelectorAll('#attendanceListBody input[type="checkbox"]').forEach(input => {
        input.checked = present;
        const enrollment = input.getAttribute('data-enrollment');
        currentAttendanceStatus[enrollment] = present;
    });
}

async function saveDivisionAttendance() {
    const alertBox = document.getElementById('attendanceOnceAlert');
    const date = document.getElementById('attendanceDateInput').value;
    const { start, end } = getAttendanceTime();

    if (!date || !start || !end) {
        alertBox.style.display = 'block';
        alertBox.className = 'alert error';
        alertBox.innerText = 'Please select date, start time and end time.';
        return;
    }

    const currentUser = getSavedUser();
    const adminSubject = (currentUser && currentUser.role === 'admin') ? currentUser.subject : 'Physics';

    const attendanceRecords = Object.entries(currentAttendanceStatus).map(([enrollment_no, present]) => ({
        enrollment_no,
        date,
        status: present ? 'Present' : 'Absent',
        division: currentAttendanceDivision,
        session_start: start,
        session_end: end,
        subject: adminSubject,
        type: 'Lecture'
    }));

    try {
        const response = await fetch(`${API_BASE}/admin/syncAttendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attendanceRecords })
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to save attendance');
        }

        alertBox.style.display = 'block';
        alertBox.className = 'alert success';
        alertBox.innerText = `Saved ${attendanceRecords.length} attendance records for division ${currentAttendanceDivision}.`;
        setTimeout(closeAttendanceModal, 1200);
    } catch (err) {
        console.error('Attendance fetch failed, trying local DB fallback:', err);
        
        // If offline or network fails, save records locally to IndexedDB for background synchronization
        if (eduSyncDB) {
            try {
                for (const r of attendanceRecords) {
                    await eduSyncDB.addAttendance(r.enrollment_no, r.date, r.status, r.division);
                }
                alertBox.style.display = 'block';
                alertBox.className = 'alert success';
                alertBox.innerText = `Saved ${attendanceRecords.length} records locally (Offline Mode).`;
                setTimeout(closeAttendanceModal, 2000);
                return;
            } catch (localErr) {
                console.error('Failed to save attendance to local IndexedDB:', localErr);
            }
        }

        alertBox.style.display = 'block';
        alertBox.className = 'alert error';
        alertBox.innerText = err.message || 'Attendance save failed';
    }
}

// Manual Sync Trigger
async function manualSync() {
    const syncBtn = document.getElementById('syncBtn');
    if (!syncBtn) return;

    if (!navigator.onLine) {
        showAppModal('Offline', 'You are offline. Will sync when connection is restored.', 'alert');
        return;
    }

    syncBtn.disabled = true;
    syncBtn.innerText = '⏳ Syncing...';
    syncBtn.style.opacity = '0.6';

    try {
        if (offlineSyncManager) {
            const results = await offlineSyncManager.syncAll();
            const att = results && results.attendance ? results.attendance : { synced: 0, failed: 0 };
            const mrk = results && results.marks ? results.marks : { synced: 0, failed: 0 };
            const total = (att.synced || 0) + (mrk.synced || 0);
            
            syncBtn.innerText = total > 0 ? '✅ Synced!' : '🔄 Sync';
            setTimeout(() => {
                syncBtn.innerText = '🔄 Sync';
                syncBtn.disabled = false;
                syncBtn.style.opacity = '1';
            }, 2000);

            showAppModal('Sync Complete', `Attendance: ${att.synced} synced, ${att.failed} failed\nMarks: ${mrk.synced} synced, ${mrk.failed} failed`, 'alert');
        }
    } catch (err) {
        syncBtn.innerText = '❌ Sync Failed';
        setTimeout(() => {
            syncBtn.innerText = '🔄 Sync';
            syncBtn.disabled = false;
            syncBtn.style.opacity = '1';
        }, 3000);
        showAppModal('Sync Failed', err.message, 'alert');
    }
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
            let percentage = attData.percentage;
            let displayStr = `${percentage}%`;
            const currentUser = getSavedUser();
            if (currentUser && currentUser.role === 'admin' && currentUser.subject) {
                const filteredAtt = attData.attendance.filter(a => a.subject === currentUser.subject);
                const total = filteredAtt.length;
                const present = filteredAtt.filter(a => a.status === 'Present').length;
                const subjPercent = total === 0 ? 0 : Math.round((present / total) * 100);
                displayStr = `${subjPercent}% (${present}/${total} sessions in ${currentUser.subject})`;
            }
            document.getElementById('modalAttendance').innerText = displayStr;
        }
    } catch(e) {
        document.getElementById('modalAttendance').innerText = 'Error';
    }

    try {
        const marksRes = await fetch(`${API_BASE}/student/getMarks/${enrollment_no}`);
        const marksData = await marksRes.json();
        if(marksData.success) {
            const currentUser = getSavedUser();
            const adminSubject = (currentUser && currentUser.role === 'admin') ? currentUser.subject : null;
            let filteredMarks = marksData.marks;
            if (adminSubject) {
                filteredMarks = marksData.marks.filter(m => (m.course || 'Physics') === adminSubject);
            }
            
            if(filteredMarks.length === 0) {
                document.getElementById('modalMarksList').innerHTML = `<p style="font-size:0.9rem; color:var(--text-muted)">No marks uploaded yet${adminSubject ? ' for ' + adminSubject : ''}.</p>`;
            } else {
                let mHtml = '<table style="width:100%; font-size:0.9rem; text-align:left;">';
                filteredMarks.forEach(m => {
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

    try {
        document.getElementById('modalAssignmentsList').innerText = 'Loading...';
        const assignRes = await fetch(`${API_BASE}/student/getAssignments/${enrollment_no}`);
        const assignData = await assignRes.json();
        if(assignData.success) {
            if(assignData.assignments.length === 0) {
                document.getElementById('modalAssignmentsList').innerHTML = '<p style="font-size:0.9rem; color:var(--text-muted)">No assignments submitted.</p>';
            } else {
                let aHtml = '<div style="display:flex; flex-direction:column; gap:0.5rem;">';
                assignData.assignments.forEach(a => {
                    const gradeStr = a.grade ? `Grade: <strong style="color:var(--primary);">${a.grade}</strong>${a.feedback ? ` (${a.feedback})` : ''}` : '<span style="color:#fb923c;">Ungraded</span>';
                    aHtml += `
                        <div style="background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px; position:relative;">
                            <strong style="font-size: 0.9rem;">${a.title}</strong><br>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${new Date(a.submitted_at).toLocaleDateString()}</span><br>
                            <span style="font-size: 0.8rem;">${gradeStr}</span>
                            <div style="float: right; margin-top: -1.75rem; display:flex; gap:0.25rem;">
                                <a href="${normalizeFileUrl(a.file_url)}" target="_blank" class="download-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">View</a>
                                <button onclick="openGradingModal(${a.id}, '${a.title.replace(/'/g, "\\'")}', '${enrollment_no}')" class="btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; background:linear-gradient(135deg, #10b981, #059669); border:none; width:auto;">Grade</button>
                            </div>
                        </div>`;
                });
                aHtml += '</div>';
                document.getElementById('modalAssignmentsList').innerHTML = aHtml;
            }
        }
    } catch(e) {
        document.getElementById('modalAssignmentsList').innerText = 'Error loading assignments';
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
        
        const currentUser = getSavedUser();
        const course = (currentUser && currentUser.role === 'admin') ? currentUser.subject : 'Physics';
        try {
            const res = await fetch(`${API_BASE}/admin/updateMarks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enrollment_no, subject, marks, course })
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
            console.error('Marks update fetch failed, trying local DB fallback:', err);
            
            // Save marks entry locally in IndexedDB if client is offline or network fails
            if (eduSyncDB) {
                try {
                    await eduSyncDB.addMarks(enrollment_no, subject, marks, course);
                    alertBox.style.display = 'block';
                    alertBox.className = 'alert success';
                    alertBox.innerText = 'Marks saved locally (Offline Mode)!';
                    document.getElementById('modalMarksValue').value = '';
                    return;
                } catch (localErr) {
                    console.error('Failed to save single marks entry to local IndexedDB:', localErr);
                }
            }

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
        const res = await fetch(`${API_BASE}/admin/getAllStudents`);
        const data = await res.json();
        currentDivStudents = data.students.filter(s => (s.division || 'A') === div);
        
        loadDivisionMarksTable();
    } catch(e) {
        showAppModal('Error', 'Failed to load division', 'alert');
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
            const currentUser = getSavedUser();
            const adminSubject = (currentUser && currentUser.role === 'admin') ? currentUser.subject : 'Physics';
            data.marks.forEach(m => {
                if(m.subject === subject && (m.course || 'Physics') === adminSubject) {
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
    
    const currentUser = getSavedUser();
    const course = (currentUser && currentUser.role === 'admin') ? currentUser.subject : 'Physics';
    try {
        const res = await fetch(`${API_BASE}/admin/bulkUpdateMarks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates, course })
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
        console.error('Bulk marks update fetch failed, trying local DB fallback:', e);
        
        // Save bulk marks entries locally to IndexedDB if offline or server is unreachable
        if (eduSyncDB) {
            try {
                for (const u of updates) {
                    await eduSyncDB.addMarks(u.enrollment_no, u.subject, u.marks, course);
                }
                alertBox.innerText = 'Saved locally (Offline Mode)!';
                alertBox.style.color = '#38bdf8'; // sky blue for offline success info
                return;
            } catch (localErr) {
                console.error('Failed to save bulk marks to local IndexedDB:', localErr);
            }
        }

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
    showAppModal('New Folder', 'Enter new folder name:', 'prompt', (fn) => {
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
    });
}

window.addSubfolder = function() {
    if (currentFolderPath.length === 0) {
        showAppModal('Error', 'Pick or create a parent folder first.', 'alert');
        return;
    }
    showAppModal('New Subfolder', `Create subfolder inside "${currentFolderPath.join('/')}":`, 'prompt', (sub) => {
        if (sub) {
            currentFolderPath.push(sub);
            updateBreadcrumb();
        }
    });
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
            if(!f) return showAppModal('Missing File', 'Please select a file to upload.', 'alert');
            formData.append('file', f);
        } else {
            const l = document.getElementById('materialLink').value;
            if(!l) return showAppModal('Missing Link', 'Please enter a valid link URL.', 'alert');
            formData.append('link_url', l);
        }
        
        const user = getSavedUser();
        if(user) formData.append('uploaded_by', user.username || user.enrollment_no);
        
        const tagsInput = document.getElementById('materialTags');
        if (tagsInput) {
            formData.append('tags', tagsInput.value.trim());
        }
        
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
                if (typeof loadAdminFiles === 'function') loadAdminFiles();
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

// =======================================
// FACE RECOGNITION SYSTEM
// =======================================

let faceModelsLoaded = false;
let faceLoginStream = null;
let faceRegStream = null;
let faceDetectionInterval = null;

async function loadFaceModels() {
    if (faceModelsLoaded) return true;
    if (typeof faceapi === 'undefined') {
        console.warn('face-api.js not loaded');
        return false;
    }
    try {
        const MODEL_URL = APP_ORIGIN + '/models';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        faceModelsLoaded = true;
        console.log('✅ Face detection models loaded');
        return true;
    } catch (err) {
        console.error('Failed to load face models:', err);
        return false;
    }
}

// --- FACE LOGIN ---
window.openFaceLoginModal = async function() {
    const modal = document.getElementById('faceLoginModal');
    const statusEl = document.getElementById('faceLoginStatus');
    const alertBox = document.getElementById('faceLoginAlert');
    const scanBtn = document.getElementById('faceLoginScanBtn');
    const video = document.getElementById('faceLoginVideo');
    
    modal.style.display = 'flex';
    alertBox.style.display = 'none';
    scanBtn.disabled = true;
    statusEl.innerText = 'Loading face detection models...';
    
    const loaded = await loadFaceModels();
    if (!loaded) {
        statusEl.innerText = 'Failed to load face models. Please try again.';
        return;
    }
    
    statusEl.innerText = 'Starting camera...';
    
    try {
        faceLoginStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } 
        });
        video.srcObject = faceLoginStream;
        await video.play();
        statusEl.innerText = 'Position your face in the frame and click "Scan & Login"';
        scanBtn.disabled = false;
        
        // Start live face detection overlay
        startFaceOverlay(video, document.getElementById('faceLoginCanvas'));
    } catch (err) {
        statusEl.innerText = 'Camera access denied. Please allow camera permissions.';
        console.error(err);
    }
};

function startFaceOverlay(video, canvas) {
    if (faceDetectionInterval) clearInterval(faceDetectionInterval);
    
    faceDetectionInterval = setInterval(async () => {
        if (!video.srcObject || video.paused) return;
        
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);
        
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();
        
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        resizedDetections.forEach(det => {
            const box = det.detection.box;
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 2;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            
            // Draw face landmarks as dots
            det.landmarks.positions.forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 1.5, 0, 2 * Math.PI);
                ctx.fillStyle = '#fb923c';
                ctx.fill();
            });
        });
    }, 200);
}

window.closeFaceLoginModal = function() {
    document.getElementById('faceLoginModal').style.display = 'none';
    if (faceLoginStream) {
        faceLoginStream.getTracks().forEach(t => t.stop());
        faceLoginStream = null;
    }
    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
        faceDetectionInterval = null;
    }
    const canvas = document.getElementById('faceLoginCanvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
};

window.attemptFaceLogin = async function() {
    const video = document.getElementById('faceLoginVideo');
    const statusEl = document.getElementById('faceLoginStatus');
    const alertBox = document.getElementById('faceLoginAlert');
    const scanBtn = document.getElementById('faceLoginScanBtn');
    
    scanBtn.disabled = true;
    statusEl.innerText = 'Scanning face...';
    alertBox.style.display = 'none';
    
    try {
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
        
        if (!detection) {
            statusEl.innerText = 'No face detected. Please position your face clearly.';
            scanBtn.disabled = false;
            return;
        }
        
        statusEl.innerText = 'Face captured! Matching...';
        
        const descriptor = Array.from(detection.descriptor);
        
        const res = await fetch(`${API_BASE}/auth/faceLogin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ descriptor })
        });
        
        const data = await res.json();
        
        if (data.success && data.multiple) {
            // Multiple matches — show account picker
            statusEl.innerText = 'Multiple accounts detected!';
            alertBox.style.display = 'none';
            
            let pickerHtml = `<div style="margin-top: 1rem; text-align: left;">
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.75rem; text-align: center;">${data.message}</p>`;
            
            data.matches.forEach((m, i) => {
                const roleColor = m.role === 'admin' ? '#f43f5e' : '#fb923c';
                const roleLabel = m.role === 'admin' ? 'ADMIN' : 'STUDENT';
                const confidence = Math.round((1 - m.distance) * 100);
                pickerHtml += `
                <button onclick="selectFaceAccount(${i})" 
                    style="width: 100%; padding: 0.8rem 1rem; margin-bottom: 0.5rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-family: 'Inter', sans-serif; transition: all 0.3s; text-align: left;"
                    onmouseover="this.style.background='rgba(244,63,94,0.1)'; this.style.borderColor='rgba(244,63,94,0.3)'"
                    onmouseout="this.style.background='rgba(255,255,255,0.04)'; this.style.borderColor='rgba(255,255,255,0.08)'">
                    <div>
                        <span style="font-weight: 600; font-size: 0.95rem;">${m.displayName}</span>
                        <span style="display: inline-block; font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 9999px; background: ${roleColor}22; color: ${roleColor}; border: 1px solid ${roleColor}33; margin-left: 0.5rem; font-weight: 700;">${roleLabel}</span>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${confidence}% match</span>
                </button>`;
            });
            
            pickerHtml += `</div>`;
            
            // Store matches globally for selection
            window._faceMatches = data.matches;
            
            // Display picker below the scan button
            let pickerContainer = document.getElementById('faceAccountPicker');
            if (!pickerContainer) {
                pickerContainer = document.createElement('div');
                pickerContainer.id = 'faceAccountPicker';
                scanBtn.parentNode.parentNode.insertBefore(pickerContainer, alertBox);
            }
            pickerContainer.innerHTML = pickerHtml;
            scanBtn.style.display = 'none';
            
        } else if (data.success) {
            closeFaceLoginModal();
            const role = data.role;
            const userData = { ...data.user, role };
            saveUserSession(userData, false);
            window.location.href = role === 'admin' ? 'admin.html' : 'dashboard.html';
        } else {
            alertBox.style.display = 'block';
            alertBox.className = 'alert error';
            alertBox.innerText = data.message;
            statusEl.innerText = 'Try again or use password login.';
            scanBtn.disabled = false;
        }
    } catch (err) {
        alertBox.style.display = 'block';
        alertBox.className = 'alert error';
        alertBox.innerText = 'Error during face scan. Please try again.';
        statusEl.innerText = 'Scan failed.';
        scanBtn.disabled = false;
        console.error(err);
    }
};

window.selectFaceAccount = function(index) {
    const match = window._faceMatches[index];
    if (!match) return;
    
    closeFaceLoginModal();
    const userData = { ...match.user, role: match.role };
    saveUserSession(userData, false);
    window.location.href = match.role === 'admin' ? 'admin.html' : 'dashboard.html';
};

// --- FACE REGISTRATION ---
window.startFaceRegistration = async function() {
    const video = document.getElementById('faceRegVideo');
    const statusEl = document.getElementById('faceRegStatus');
    const alertBox = document.getElementById('faceRegAlert');
    const startBtn = document.getElementById('faceRegStartBtn');
    const captureBtn = document.getElementById('faceRegCaptureBtn');
    const stopBtn = document.getElementById('faceRegStopBtn');
    
    alertBox.style.display = 'none';
    statusEl.innerHTML = '<span style="color: #fbbf24;">Loading face models...</span>';
    
    const loaded = await loadFaceModels();
    if (!loaded) {
        statusEl.innerHTML = '<span style="color: #ef4444;">Failed to load face models.</span>';
        return;
    }
    
    try {
        faceRegStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } 
        });
        video.srcObject = faceRegStream;
        video.style.display = 'block';
        await video.play();
        
        startBtn.style.display = 'none';
        captureBtn.style.display = 'inline-flex';
        stopBtn.style.display = 'inline-flex';
        statusEl.innerHTML = '<span style="color: #6ee7b7;">Camera active. Position your face and click "Capture & Register".</span>';
        
        startFaceOverlay(video, document.getElementById('faceRegCanvas'));
    } catch (err) {
        statusEl.innerHTML = '<span style="color: #ef4444;">Camera access denied.</span>';
        console.error(err);
    }
};

window.stopFaceRegistration = function() {
    const video = document.getElementById('faceRegVideo');
    if (faceRegStream) {
        faceRegStream.getTracks().forEach(t => t.stop());
        faceRegStream = null;
    }
    video.style.display = 'none';
    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
        faceDetectionInterval = null;
    }
    const canvas = document.getElementById('faceRegCanvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    
    document.getElementById('faceRegStartBtn').style.display = 'inline-flex';
    document.getElementById('faceRegCaptureBtn').style.display = 'none';
    document.getElementById('faceRegStopBtn').style.display = 'none';
    document.getElementById('faceRegStatus').innerHTML = '';
};

window.captureFaceRegistration = async function() {
    const video = document.getElementById('faceRegVideo');
    const statusEl = document.getElementById('faceRegStatus');
    const alertBox = document.getElementById('faceRegAlert');
    const captureBtn = document.getElementById('faceRegCaptureBtn');
    
    captureBtn.disabled = true;
    statusEl.innerHTML = '<span style="color: #fbbf24;">Scanning face...</span>';
    
    try {
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
        
        if (!detection) {
            statusEl.innerHTML = '<span style="color: #ef4444;">No face detected. Try again.</span>';
            captureBtn.disabled = false;
            return;
        }
        
        const descriptor = Array.from(detection.descriptor);
        const user = getSavedUser();
        
        if (!user) {
            statusEl.innerHTML = '<span style="color: #ef4444;">Not logged in.</span>';
            captureBtn.disabled = false;
            return;
        }
        
        const id = user.enrollment_no || user.username;
        const role = user.role;
        
        statusEl.innerHTML = '<span style="color: #fbbf24;">Saving face data...</span>';
        
        const res = await fetch(`${API_BASE}/auth/registerFace`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, role, descriptor })
        });
        
        const data = await res.json();
        
        alertBox.style.display = 'block';
        if (data.success) {
            alertBox.className = 'alert success';
            alertBox.innerText = data.message;
            statusEl.innerHTML = '<span style="color: #6ee7b7;">✅ Face registered successfully!</span>';
            stopFaceRegistration();
        } else {
            alertBox.className = 'alert error';
            alertBox.innerText = data.message;
            statusEl.innerHTML = '<span style="color: #ef4444;">Registration failed.</span>';
        }
        captureBtn.disabled = false;
    } catch (err) {
        alertBox.style.display = 'block';
        alertBox.className = 'alert error';
        alertBox.innerText = 'Error during face registration.';
        captureBtn.disabled = false;
        console.error(err);
    }
};

// ==========================================
// GRAPHICAL TIMETABLE & SCHEDULER SYSTEM
// ==========================================
let timetableMode = 'general'; // 'general' or 'attendance'
let activeSchedules = [];

// Clean up and determine division/type gradient styles dynamically via string hashing
function getScheduleGradient(division, type, filterMode, customColor = null) {
    if (customColor && customColor.trim() !== '') {
        return customColor;
    }
    
    const cleanDiv = (division || 'Q').toUpperCase().trim();
    const cleanType = (type || 'Theory').toLowerCase();
    
    // Division-specific View: distinguish by Session Type!
    if (filterMode && filterMode !== 'ALL') {
        if (cleanType.includes('lab')) return 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'; // Cyan
        if (cleanType.includes('tut')) return 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'; // Purple
        return 'linear-gradient(135deg, #10b981 0%, #059669 100%)'; // Green (Theory)
    }
    
    // General / Merged View: distinguish Divisions by Color!
    let hash = 0;
    for (let i = 0; i < cleanDiv.length; i++) {
        hash = cleanDiv.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const baseHues = [
        12,   // Coral / Sunset Rose
        138,  // Emerald / Lime Green
        188,  // Ocean Blue / Cyan
        268,  // Deep Purple / Violet
        322,  // Magenta / Neon Pink
        38,   // Warm Amber / Gold
        215,  // Sky Blue / Royal Blue
        162   // Mint Green / Teal
    ];
    
    const idx = Math.abs(hash) % baseHues.length;
    const hue = baseHues[idx];
    return `linear-gradient(135deg, hsl(${hue}, 75%, 45%) 0%, hsl(${(hue + 30) % 360}, 85%, 35%) 100%)`;
}

// Dynamically fetch unique divisions from database and populate filters
async function populateTimetableDivisions() {
    try {
        const res = await fetch(`${API_BASE}/admin/getAllStudents`);
        const data = await res.json();
        
        let divisions = [];
        if (data.success && data.students) {
            const unique = new Set();
            data.students.forEach(s => {
                if (s.division) unique.add(s.division.trim().toUpperCase());
            });
            divisions = Array.from(unique).sort();
        }
        
        // Fallback to active testing divisions Q and R
        if (divisions.length === 0) {
            divisions = ['Q', 'R'];
        }
        
        // Populate timetable view filter
        const filterDropdown = document.getElementById('timetableDivFilter');
        const currentFilterVal = filterDropdown.value || 'ALL';
        
        filterDropdown.innerHTML = `<option value="ALL">All Divisions (Merged View)</option>`;
        divisions.forEach(div => {
            filterDropdown.innerHTML += `<option value="${div}">Division ${div} Only</option>`;
        });
        
        if (divisions.includes(currentFilterVal) || currentFilterVal === 'ALL') {
            filterDropdown.value = currentFilterVal;
        } else {
            filterDropdown.value = 'ALL';
        }
        
        // Populate slot editor division select option
        const editorDropdown = document.getElementById('slotEditorDiv');
        const currentEditorVal = editorDropdown.value;
        editorDropdown.innerHTML = '';
        
        divisions.forEach(div => {
            editorDropdown.innerHTML += `<option value="${div}">Division ${div}</option>`;
        });
        editorDropdown.innerHTML += `<option value="NEW_CUSTOM">+ Add Custom Division...</option>`;
        
        if (divisions.includes(currentEditorVal)) {
            editorDropdown.value = currentEditorVal;
        } else if (divisions.length > 0) {
            editorDropdown.value = divisions[0];
        }
        
        // Event listener for adding custom divisions on-the-fly
        editorDropdown.onchange = () => {
            if (editorDropdown.value === 'NEW_CUSTOM') {
                const customName = prompt('Enter custom division letter/name (e.g. S):');
                if (customName && customName.trim() !== '') {
                    const cleanName = customName.trim().toUpperCase();
                    const opt = document.createElement('option');
                    opt.value = cleanName;
                    opt.innerText = `Division ${cleanName}`;
                    editorDropdown.insertBefore(opt, editorDropdown.lastElementChild);
                    editorDropdown.value = cleanName;
                } else {
                    editorDropdown.value = divisions[0] || 'Q';
                }
            }
        };
    } catch(err) {
        console.error('Error populating dynamic timetable divisions:', err);
    }
}

// Open Timetable from General Admin dashboard
window.openGeneralTimetable = async function() {
    timetableMode = 'general';
    document.getElementById('timetableSelectionHint').style.display = 'none';
    document.getElementById('timetableModeNotice').innerText = '💡 Select a specific division from the dropdown filter to schedule or edit slots graphically.';
    await populateTimetableDivisions();
    document.getElementById('timetableModal').style.display = 'flex';
    document.getElementById('timetableDivFilter').value = 'ALL';
    loadTimetableData();
};

// Open Timetable from Attendance feature
window.openTimetableFromAttendance = async function() {
    timetableMode = 'attendance';
    document.getElementById('timetableSelectionHint').style.display = 'inline-block';
    document.getElementById('timetableModeNotice').innerText = '🎯 Click any scheduled slot block below to automatically autofill the attendance details!';
    await populateTimetableDivisions();
    
    // Set filter to match the division we are currently preparing attendance for
    const activeDiv = currentAttendanceDivision || 'Q';
    document.getElementById('timetableDivFilter').value = activeDiv;
    
    document.getElementById('timetableModal').style.display = 'flex';
    loadTimetableData();
};

window.closeTimetableModal = function() {
    document.getElementById('timetableModal').style.display = 'none';
};

window.loadTimetableData = async function() {
    try {
        const res = await fetch(`${API_BASE}/admin/getSchedule`);
        const data = await res.json();
        if (data.success) {
            activeSchedules = data.schedules;
            renderTimetableGrid();
        }
    } catch(err) {
        console.error('Error fetching schedule data:', err);
    }
};

window.renderTimetableGrid = function() {
    const filter = document.getElementById('timetableDivFilter').value;
    const tbody = document.getElementById('timetableGridBody');
    tbody.innerHTML = '';
    
    // Restrict timetable views to the logged-in admin's specific assigned subject
    const user = getSavedUser();
    const adminSubject = (user && user.role === 'admin') ? user.subject : '';
    
    const slots = [
        { label: '10:30 AM - 11:30 AM', time: '10:30-11:30', type: 'lecture' },
        { label: '11:30 AM - 12:30 PM', time: '11:30-12:30', type: 'lecture' },
        { label: '12:30 PM - 01:00 PM', time: '12:30-13:00', type: 'lunch' },
        { label: '01:00 PM - 02:00 PM', time: '13:00-14:00', type: 'lecture' },
        { label: '02:00 PM - 03:00 PM', time: '14:00-15:00', type: 'lecture' },
        { label: '03:00 PM - 03:15 PM', time: '15:00-15:15', type: 'break' },
        { label: '03:15 PM - 04:15 PM', time: '15:15-16:15', type: 'lecture' },
        { label: '04:15 PM - 05:15 PM', time: '16:15-17:15', type: 'lecture' }
    ];
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    slots.forEach(slot => {
        const tr = document.createElement('tr');
        tr.style.height = slot.type === 'lecture' ? '90px' : '40px';
        
        // Time slot header column
        const tdTime = document.createElement('td');
        tdTime.style.background = 'rgba(255, 255, 255, 0.03)';
        tdTime.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        tdTime.style.padding = '0.5rem';
        tdTime.style.borderRadius = '6px';
        tdTime.innerHTML = `<strong style="font-size: 0.85rem; color: #fda4af; display:block;">${slot.label.split(' - ')[0]}</strong><span style="font-size: 0.75rem; color: var(--text-muted);">${slot.label.split(' - ')[1]}</span>`;
        tr.appendChild(tdTime);
        
        if (slot.type === 'lunch') {
            const tdBreak = document.createElement('td');
            tdBreak.setAttribute('colspan', '5');
            tdBreak.style.background = 'linear-gradient(90deg, rgba(244,63,94,0.08) 0%, rgba(251,146,60,0.08) 50%, rgba(244,63,94,0.08) 100%)';
            tdBreak.style.border = '1px dashed rgba(244, 63, 94, 0.2)';
            tdBreak.style.borderRadius = '6px';
            tdBreak.style.fontSize = '0.85rem';
            tdBreak.style.fontWeight = '600';
            tdBreak.style.color = '#fecdd3';
            tdBreak.innerHTML = '☕ 12:30 - 1:00 PM &nbsp;&bull;&nbsp; LUNCH BREAK &nbsp;&bull;&nbsp; REST TIME';
            tr.appendChild(tdBreak);
        } else if (slot.type === 'break') {
            const tdBreak = document.createElement('td');
            tdBreak.setAttribute('colspan', '5');
            tdBreak.style.background = 'linear-gradient(90deg, rgba(124,58,237,0.08) 0%, rgba(6,182,212,0.08) 50%, rgba(124,58,237,0.08) 100%)';
            tdBreak.style.border = '1px dashed rgba(124, 58, 237, 0.2)';
            tdBreak.style.borderRadius = '6px';
            tdBreak.style.fontSize = '0.82rem';
            tdBreak.style.fontWeight = '600';
            tdBreak.style.color = '#ddd6fe';
            tdBreak.innerHTML = '🍪 3:00 - 3:15 PM &nbsp;&bull;&nbsp; SHORT BREAK';
            tr.appendChild(tdBreak);
        } else {
            // Lecture row columns for days
            days.forEach(day => {
                const td = document.createElement('td');
                td.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                td.style.borderRadius = '6px';
                td.style.background = 'rgba(255, 255, 255, 0.01)';
                td.style.position = 'relative';
                td.style.padding = '4px';
                td.style.verticalAlign = 'top';
                
                // Fetch scheduled items matching day and time_slot
                let matched = activeSchedules.filter(s => s.day === day && s.time_slot === slot.time);
                if (adminSubject) {
                    matched = matched.filter(s => s.subject === adminSubject);
                }
                if (filter !== 'ALL') {
                    matched = matched.filter(s => s.division === filter);
                }
                
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.gap = '4px';
                container.style.height = '100%';
                container.style.justifyContent = 'center';
                
                if (matched.length > 0) {
                    matched.forEach(item => {
                        const block = document.createElement('div');
                        block.style.background = getScheduleGradient(item.division, item.type, filter, item.color);
                        block.style.color = 'white';
                        block.style.borderRadius = '4px';
                        block.style.padding = '0.35rem 0.5rem';
                        block.style.fontSize = '0.78rem';
                        block.style.fontWeight = '600';
                        block.style.textAlign = 'left';
                        block.style.cursor = 'pointer';
                        block.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                        block.style.border = '1px solid rgba(255,255,255,0.15)';
                        block.setAttribute('draggable', 'true');
                        block.ondragstart = (e) => {
                            if (timetableMode !== 'general') {
                                e.preventDefault();
                                return;
                            }
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                                item: item,
                                originDay: day,
                                originTime: slot.time
                            }));
                            block.style.opacity = '0.5';
                        };
                        block.ondragend = () => {
                            block.style.opacity = '1';
                        };
                        
                        block.onclick = (e) => {
                            e.stopPropagation();
                            if (timetableMode === 'attendance') {
                                // AUTO FILL ATTENDANCE FIELDS!
                                const startPart = slot.time.split('-')[0];
                                const endPart = slot.time.split('-')[1];
                                
                                document.getElementById('attendanceStartTime').value = startPart;
                                document.getElementById('attendanceEndTime').value = endPart;
                                document.getElementById('attendanceDivisionInput').value = item.division;
                                currentAttendanceDivision = item.division;
                                
                                // Auto load class grid instantly
                                loadDivisionAttendance();
                                closeTimetableModal();
                            } else {
                                // EDIT Popover
                                openSlotEditor(day, slot.time, item);
                            }
                        };
                        
                        block.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:0.8rem; font-weight:700;">${item.subject.replace('Basic Electrical Engineering', 'BEE').replace('Computer Programming', 'Programming').replace('Engineering Graphics', 'Graphics')}</span>
                                <span style="font-size:0.68rem; background:rgba(0,0,0,0.2); padding:1px 4px; border-radius:3px;">Div ${item.division}</span>
                            </div>
                            <div style="font-size:0.7rem; opacity:0.85; margin-top:2px;">
                                &#128214; ${item.type}
                            </div>
                        `;
                        container.appendChild(block);
                    });
                } else {
                    // Empty Cell visual placeholder
                    if (timetableMode === 'general') {
                        td.style.cursor = 'pointer';
                        td.onmouseover = () => { td.style.background = 'rgba(255,255,255,0.03)'; };
                        td.onmouseout = () => { td.style.background = 'rgba(255,255,255,0.01)'; };
                        td.onclick = () => {
                            if (filter === 'ALL') {
                                alert('Please select a specific Division filter (A, B, or C) from the filter bar to add a new scheduled slot graphically.');
                            } else {
                                openSlotEditor(day, slot.time, null, filter);
                            }
                        };
                    }
                }
                
                // DRAG OVER / LEAVE / DROP events on cells
                td.ondragover = (e) => {
                    e.preventDefault();
                    if (timetableMode === 'general') td.classList.add('drag-over');
                };
                td.ondragleave = () => {
                    td.classList.remove('drag-over');
                };
                td.ondrop = async (e) => {
                    e.preventDefault();
                    td.classList.remove('drag-over');
                    if (timetableMode !== 'general') return;
                    try {
                        const dataStr = e.dataTransfer.getData('text/plain');
                        if (!dataStr) return;
                        const data = JSON.parse(dataStr);
                        const { item, originDay, originTime } = data;
                        
                        if (originDay === day && originTime === slot.time) return;
                        
                        // Save slot to new day/time
                        const saveRes = await fetch(`${API_BASE}/admin/saveSchedule`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                day: day,
                                time_slot: slot.time,
                                subject: item.subject,
                                type: item.type,
                                division: item.division,
                                color: item.color
                            })
                        });
                        const saveData = await saveRes.json();
                        if (saveData.success) {
                            // Delete old slot
                            await fetch(`${API_BASE}/admin/saveSchedule`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    day: originDay,
                                    time_slot: originTime,
                                    subject: '',
                                    division: item.division
                                })
                            });
                            loadTimetableData();
                        } else {
                            showAppModal('Conflict Detected', saveData.message || 'Clash! Division is already booked.', 'alert');
                        }
                    } catch(err) {
                        console.error('Drag update error:', err);
                    }
                };
                
                td.appendChild(container);
                tr.appendChild(td);
            });
        }
        tbody.appendChild(tr);
    });
};

// Open the graphical Slot Editor Popover modal
window.openSlotEditor = function(day, time, existingItem = null, filterDiv = '') {
    document.getElementById('slotEditorDay').value = day;
    document.getElementById('slotEditorTime').value = time;
    
    const divSelect = document.getElementById('slotEditorDiv');
    const subjSelect = document.getElementById('slotEditorSubject');
    
    // Set header labels
    document.getElementById('slotEditorTitle').innerText = existingItem ? '🛠️ Edit Class Schedule Slot' : '📅 Schedule New Class Slot';
    document.getElementById('slotEditorSubtitle').innerText = `${day} at ${time}`;
    
    // Lock/Autofill subject if logged in Admin belongs to a specific subject
    const user = getSavedUser();
    const adminSubject = (user && user.role === 'admin') ? user.subject : '';
    
    if (existingItem) {
        // Edit mode
        document.getElementById('slotEditorDivGroup').style.display = 'block';
        divSelect.value = existingItem.division;
        subjSelect.value = existingItem.subject;
        updateSlotEditorTypeOptions();
        document.getElementById('slotEditorType').value = existingItem.type;
    } else {
        // Create mode
        document.getElementById('slotEditorDivGroup').style.display = 'block';
        divSelect.value = filterDiv || 'Q';
        if (adminSubject) {
            subjSelect.value = adminSubject;
        } else {
            subjSelect.value = '';
        }
        updateSlotEditorTypeOptions();
    }
    
    // Lock subject selector if adminSubject is active
    if (adminSubject) {
        subjSelect.value = adminSubject;
        subjSelect.disabled = true;
        subjSelect.style.border = '1px solid rgba(16, 185, 129, 0.4)';
        subjSelect.style.background = 'rgba(16, 185, 129, 0.05)';
        subjSelect.style.opacity = '0.7';
    } else {
        subjSelect.disabled = false;
        subjSelect.style.border = '';
        subjSelect.style.background = '';
        subjSelect.style.opacity = '1';
    }
    
    // Generate beautiful interactive visual color picker palette
    const presets = [
        { name: 'Sunset Coral', value: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)' },
        { name: 'Emerald Mint', value: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' },
        { name: 'Ocean Cyan', value: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
        { name: 'Indigo Dream', value: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' },
        { name: 'Amber Glow', value: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)' },
        { name: 'Rose Orchid', value: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)' }
    ];
    
    const paletteContainer = document.getElementById('slotColorPalette');
    if (paletteContainer) {
        paletteContainer.innerHTML = '';
        const selectedColor = existingItem ? (existingItem.color || '') : '';
        document.getElementById('slotEditorColor').value = selectedColor;
        
        presets.forEach(preset => {
            const circle = document.createElement('div');
            circle.style.width = '30px';
            circle.style.height = '30px';
            circle.style.borderRadius = '50%';
            circle.style.background = preset.value;
            circle.style.cursor = 'pointer';
            circle.style.transition = 'all 0.15s ease';
            circle.style.border = '2px solid transparent';
            circle.title = preset.name;
            
            if (selectedColor === preset.value) {
                circle.style.border = '2px solid #ffffff';
                circle.style.transform = 'scale(1.15)';
                circle.style.boxShadow = '0 0 12px rgba(255, 255, 255, 0.6)';
            }
            
            circle.onclick = () => {
                document.getElementById('slotEditorColor').value = preset.value;
                Array.from(paletteContainer.children).forEach(child => {
                    child.style.border = '2px solid transparent';
                    child.style.transform = 'scale(1)';
                    child.style.boxShadow = 'none';
                });
                circle.style.border = '2px solid #ffffff';
                circle.style.transform = 'scale(1.15)';
                circle.style.boxShadow = '0 0 12px rgba(255, 255, 255, 0.6)';
            };
            
            paletteContainer.appendChild(circle);
        });
    }
    
    document.getElementById('slotEditorModal').style.display = 'flex';
};

window.updateSlotEditorTypeOptions = function() {
    const subject = document.getElementById('slotEditorSubject').value;
    const typeSelect = document.getElementById('slotEditorType');
    typeSelect.innerHTML = '';
    
    if (subject === 'Maths') {
        typeSelect.innerHTML = `
            <option value="Theory">Theory Session</option>
            <option value="Tutorial">Tutorial Session</option>
        `;
    } else if (subject) {
        typeSelect.innerHTML = `
            <option value="Theory">Theory Session</option>
            <option value="Lab Practical">Lab Practical Session</option>
        `;
    } else {
        typeSelect.innerHTML = `<option value="">-- Choose Subject First --</option>`;
    }
};

window.clearSlotEditor = async function() {
    const day = document.getElementById('slotEditorDay').value;
    const time = document.getElementById('slotEditorTime').value;
    const division = document.getElementById('slotEditorDiv').value;
    
    if (confirm(`Are you sure you want to clear this scheduled slot for Division ${division}?`)) {
        try {
            const res = await fetch(`${API_BASE}/admin/saveSchedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ day, time_slot: time, division, subject: '' }) // Empty subject clears the slot
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('slotEditorModal').style.display = 'none';
                loadTimetableData();
            }
        } catch(err) {
            console.error('Error clearing schedule slot:', err);
        }
    }
};

// Form submit handler for saving schedules
const slotEditorForm = document.getElementById('slotEditorForm');
if (slotEditorForm) {
    slotEditorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const day = document.getElementById('slotEditorDay').value;
        const time = document.getElementById('slotEditorTime').value;
        const division = document.getElementById('slotEditorDiv').value;
        const subject = document.getElementById('slotEditorSubject').value;
        const type = document.getElementById('slotEditorType').value;
        const color = document.getElementById('slotEditorColor').value;
        
        try {
            const res = await fetch(`${API_BASE}/admin/saveSchedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ day, time_slot: time, division, subject, type, color })
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('slotEditorModal').style.display = 'none';
                loadTimetableData();
            } else {
                alert(`⚠️ Double Booking Clash!\n\n${data.message || 'Could not save slot due to schedule clashing.'}`);
            }
        } catch(err) {
            console.error('Error saving schedule slot:', err);
            alert('⚠️ Network error saving schedule slot.');
        }
    });
}

// Student Portal Timetable graphical rendering
window.loadStudentTimetable = async function() {
    try {
        const user = getSavedUser();
        if (!user || user.role !== 'student') return;
        
        const division = (user.division || '').toUpperCase().trim() || 'Q';
        const label = document.getElementById('studentTimetableDivLabel');
        if (label) label.innerText = `Division ${division}`;
        
        const res = await fetch(`${API_BASE}/admin/getSchedule?division=${division}`);
        const data = await res.json();
        
        if (data.success) {
            const tbody = document.getElementById('studentTimetableBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            
            const slots = [
                { label: '10:30 AM - 11:30 AM', time: '10:30-11:30', type: 'lecture' },
                { label: '11:30 AM - 12:30 PM', time: '11:30-12:30', type: 'lecture' },
                { label: '12:30 PM - 01:00 PM', time: '12:30-13:00', type: 'lunch' },
                { label: '01:00 PM - 02:00 PM', time: '13:00-14:00', type: 'lecture' },
                { label: '02:00 PM - 03:00 PM', time: '14:00-15:00', type: 'lecture' },
                { label: '03:00 PM - 03:15 PM', time: '15:00-15:15', type: 'break' },
                { label: '03:15 PM - 04:15 PM', time: '15:15-16:15', type: 'lecture' },
                { label: '04:15 PM - 05:15 PM', time: '16:15-17:15', type: 'lecture' }
            ];
            
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            
            slots.forEach(slot => {
                const tr = document.createElement('tr');
                tr.style.height = slot.type === 'lecture' ? '70px' : '30px';
                
                const tdTime = document.createElement('td');
                tdTime.style.background = 'rgba(255, 255, 255, 0.03)';
                tdTime.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                tdTime.style.padding = '0.35rem';
                tdTime.style.borderRadius = '4px';
                tdTime.innerHTML = `<strong style="font-size: 0.75rem; color: #fda4af; display:block;">${slot.label.split(' - ')[0]}</strong><span style="font-size: 0.65rem; color: var(--text-muted);">${slot.label.split(' - ')[1]}</span>`;
                tr.appendChild(tdTime);
                
                if (slot.type === 'lunch') {
                    const tdBreak = document.createElement('td');
                    tdBreak.setAttribute('colspan', '5');
                    tdBreak.style.background = 'rgba(255,255,255,0.02)';
                    tdBreak.style.border = '1px dashed rgba(255,255,255,0.1)';
                    tdBreak.style.fontSize = '0.75rem';
                    tdBreak.style.color = 'var(--text-muted)';
                    tdBreak.innerText = '☕ LUNCH BREAK (12:30 - 1:00 PM)';
                    tr.appendChild(tdBreak);
                } else if (slot.type === 'break') {
                    const tdBreak = document.createElement('td');
                    tdBreak.setAttribute('colspan', '5');
                    tdBreak.style.background = 'rgba(255,255,255,0.02)';
                    tdBreak.style.border = '1px dashed rgba(255,255,255,0.1)';
                    tdBreak.style.fontSize = '0.72rem';
                    tdBreak.style.color = 'var(--text-muted)';
                    tdBreak.innerText = '🍪 SHORT BREAK (3:00 - 3:15 PM)';
                    tr.appendChild(tdBreak);
                } else {
                    days.forEach(day => {
                        const td = document.createElement('td');
                        td.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                        td.style.borderRadius = '4px';
                        td.style.background = 'rgba(255, 255, 255, 0.01)';
                        td.style.padding = '4px';
                        td.style.verticalAlign = 'middle';
                        
                        const matched = data.schedules.find(s => s.day === day && s.time_slot === slot.time);
                        if (matched) {
                            // In single division specific view, always distinguish by class session type!
                            td.style.background = getScheduleGradient(matched.division, matched.type, 'SINGLE', matched.color);
                            td.style.color = 'white';
                            td.style.fontSize = '0.72rem';
                            td.style.fontWeight = '600';
                            td.style.textAlign = 'center';
                            td.style.borderRadius = '4px';
                            td.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                            td.innerHTML = `
                                <div style="font-weight: 700;">${matched.subject.replace('Basic Electrical Engineering', 'BEE').replace('Computer Programming', 'Programming').replace('Engineering Graphics', 'Graphics')}</div>
                                <div style="font-size: 0.62rem; opacity: 0.8; margin-top: 1px;">(${matched.type})</div>
                            `;
                        } else {
                            td.innerHTML = '<span style="color: rgba(255,255,255,0.1); font-size: 0.65rem;">--</span>';
                        }
                        tr.appendChild(td);
                    });
                }
                tbody.appendChild(tr);
            });
        }
    } catch(err) {
        console.error('Error loading student timetable:', err);
    }
};

window.downloadStudentTimetable = function() {
    const style = document.createElement('style');
    style.innerHTML = `
        @media print {
            body * {
                visibility: hidden;
            }
            #studentPrintArea, #studentPrintArea * {
                visibility: visible;
            }
            #studentPrintArea {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white !important;
                color: black !important;
                border: 1px solid #ccc !important;
                padding: 1rem !important;
            }
            table th, table td {
                color: black !important;
                border: 1px solid #333 !important;
            }
            table td {
                background: #f3f4f6 !important;
            }
        }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
};

// --- Advanced Features Code Integrations ---

// Theme Toggler
window.toggleTheme = function() {
    if (document.body.classList.contains('light-theme')) {
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
    }
    window.location.reload();
};

function initTheme() {
    const theme = localStorage.getItem('theme') || 'dark';
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}
initTheme();

// Web Push Notifications Registration
async function setupPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications are not supported in this browser.');
        return;
    }
    
    try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            const keyRes = await fetch(`${API_BASE}/push-vapid-key`);
            const keyData = await keyRes.json();
            if (!keyData.publicKey) return;
            
            const convertedVapidKey = urlBase64ToUint8Array(keyData.publicKey);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        }
        
        const user = getSavedUser();
        if (user) {
            await fetch(`${API_BASE}/push-subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription,
                    enrollment_no: user.enrollment_no || null,
                    username: user.username || null
                })
            });
        }
    } catch(err) {
        console.warn('Push notification subscription setup failed:', err);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Sockets Student Chat Join
window.joinStudentChatRoom = function() {
    let user = getSavedUser();
    if (!user || typeof io === 'undefined') return;
    
    const division = user.division || 'A';
    const chatDiv = document.getElementById('chatDivName');
    if (chatDiv) chatDiv.innerText = division;
    
    const socket = io();
    socket.emit('join_room', { division, name: user.name || 'Student', id: user.enrollment_no });
    
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.onsubmit = (e) => {
            e.preventDefault();
            const inp = document.getElementById('chatInput');
            const msg = inp.value.trim();
            if (msg) {
                socket.emit('send_message', {
                    division,
                    sender_name: user.name || 'Student',
                    sender_id: user.enrollment_no,
                    message: msg
                });
                inp.value = '';
            }
        };
    }
    
    socket.on('chat_history', (messages) => {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
            if (messages.length === 0) {
                chatMessages.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin-top: auto;">No messages yet. Say hello!</div>';
            } else {
                messages.forEach(m => appendChatMessage(m, user.enrollment_no));
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
    
    socket.on('receive_message', (m) => {
        appendChatMessage(m, user.enrollment_no);
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    });
};

// Dynamic Chat Divisions Load
window.loadChatDivisions = async function() {
    const select = document.getElementById('chatDivisionSelect');
    if (!select) return;
    
    try {
        const res = await fetch(`${API_BASE}/admin/divisions`);
        const data = await res.json();
        if (data.success && data.divisions && data.divisions.length > 0) {
            select.innerHTML = data.divisions.map(div => 
                `<option value="${div}">Division ${div}</option>`
            ).join('');
            
            // Join room for the first division by default
            joinAdminChatRoom();
        } else {
            select.innerHTML = '<option value="">No active divisions</option>';
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin-top: auto;">No divisions with active students exist.</div>';
            }
        }
    } catch (err) {
        console.error('Error loading chat divisions:', err);
        select.innerHTML = '<option value="">Error loading divisions</option>';
    }
};

// Sockets Admin Chat Join
let adminSocket = null;
window.joinAdminChatRoom = function() {
    const divisionSelect = document.getElementById('chatDivisionSelect');
    if (!divisionSelect) return;
    const division = divisionSelect.value;
    if (!division) return;
    const user = getSavedUser();
    if (!user || typeof io === 'undefined') return;
    
    if (adminSocket) {
        adminSocket.disconnect();
    }
    
    adminSocket = io();
    adminSocket.emit('join_room', { division, name: user.name || 'Admin', id: user.username });
    
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.style.display = 'flex';
        chatForm.onsubmit = (e) => {
            e.preventDefault();
            const inp = document.getElementById('chatInput');
            const msg = inp.value.trim();
            const sendEmailChecked = document.getElementById('chatSendEmail') ? document.getElementById('chatSendEmail').checked : false;
            
            if (msg) {
                adminSocket.emit('send_message', {
                    division,
                    sender_name: `${user.name || 'Admin'} (${user.subject || 'Staff'})`,
                    sender_id: user.username,
                    message: msg,
                    send_email: sendEmailChecked
                });
                if (document.getElementById('chatSendEmail')) {
                    document.getElementById('chatSendEmail').checked = false;
                }
                inp.value = '';
            }
        };
    }
    
    adminSocket.on('chat_history', (messages) => {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
            if (messages.length === 0) {
                chatMessages.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin-top: auto;">No messages yet. Say hello!</div>';
            } else {
                messages.forEach(m => appendChatMessage(m, user.username));
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
    
    adminSocket.on('receive_message', (m) => {
        appendChatMessage(m, user.username);
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    });
};

function appendChatMessage(msg, currentUserId) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const isOutgoing = msg.sender_id === currentUserId;
    
    // Remove empty list visual helper if present
    if (chatMessages.innerText.includes('No messages yet') || chatMessages.innerText.includes('Select a room')) {
        chatMessages.innerHTML = '';
    }
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${isOutgoing ? 'outgoing' : 'incoming'}`;
    
    const metaSpan = document.createElement('span');
    metaSpan.className = 'meta';
    metaSpan.innerText = isOutgoing ? 'You' : msg.sender_name;
    
    const textSpan = document.createElement('span');
    textSpan.innerText = msg.message;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'time';
    const date = new Date(msg.timestamp);
    timeSpan.innerText = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    msgDiv.appendChild(metaSpan);
    msgDiv.appendChild(textSpan);
    msgDiv.appendChild(timeSpan);
    chatMessages.appendChild(msgDiv);
}

// Assignment Grading Open Modal
window.openGradingModal = function(assignmentId, title, enrollmentNo) {
    document.getElementById('gradingModalAssignmentId').value = assignmentId;
    document.getElementById('gradingModalTitle').innerText = `Grading: ${title} (Student: ${enrollmentNo})`;
    document.getElementById('gradingModalGrade').value = '';
    document.getElementById('gradingModalFeedback').value = '';
    
    const alertBox = document.getElementById('gradingModalAlert');
    if (alertBox) {
        alertBox.style.display = 'none';
        alertBox.innerText = '';
    }
    document.getElementById('assignmentGradingModal').style.display = 'flex';
};

// Wire up Grading Form Submit
const gradingForm = document.getElementById('assignmentGradingForm');
if (gradingForm) {
    gradingForm.onsubmit = async (e) => {
        e.preventDefault();
        const alertBox = document.getElementById('gradingModalAlert');
        const assignment_id = document.getElementById('gradingModalAssignmentId').value;
        const grade = document.getElementById('gradingModalGrade').value.trim();
        const feedback = document.getElementById('gradingModalFeedback').value.trim();
        
        const user = getSavedUser();
        const graded_by = user ? (user.name || user.username) : 'Admin';
        
        try {
            const res = await fetch(`${API_BASE}/admin/gradeAssignment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignment_id, grade, feedback, graded_by })
            });
            const data = await res.json();
            alertBox.style.display = 'block';
            if (data.success) {
                alertBox.className = 'alert success';
                alertBox.innerText = 'Grade submitted successfully!';
                
                // Refresh modal view
                const enrollment_no = document.getElementById('modalMarksEnrollment').value;
                if (enrollment_no) {
                    openStudentModal(enrollment_no, document.getElementById('modalStudentName').innerText);
                }
                setTimeout(() => {
                    document.getElementById('assignmentGradingModal').style.display = 'none';
                }, 1000);
            } else {
                alertBox.className = 'alert error';
                alertBox.innerText = data.message || 'Failed to submit grade.';
            }
        } catch (err) {
            console.error('Grading submit error:', err);
            alertBox.style.display = 'block';
            alertBox.className = 'alert error';
            alertBox.innerText = 'Server error submitting grade.';
        }
    };
}

// Tag Filtering Search Functions
window.filterMaterials = function() {
    const query = document.getElementById('filesSearchInput').value.toLowerCase().trim();
    const items = document.querySelectorAll('#filesContainer .file-item');
    items.forEach(el => {
        const name = el.getAttribute('data-name') || '';
        const tags = el.getAttribute('data-tags') || '';
        if (name.toLowerCase().includes(query) || tags.toLowerCase().includes(query)) {
            el.style.display = 'flex';
        } else {
            el.style.display = 'none';
        }
    });
};

window.filterAdminMaterials = function() {
    const query = document.getElementById('adminFilesSearchInput').value.toLowerCase().trim();
    const items = document.querySelectorAll('#adminFilesContainer .file-item');
    items.forEach(el => {
        const name = el.getAttribute('data-name') || '';
        const tags = el.getAttribute('data-tags') || '';
        if (name.toLowerCase().includes(query) || tags.toLowerCase().includes(query)) {
            el.style.display = 'flex';
        } else {
            el.style.display = 'none';
        }
    });
};

