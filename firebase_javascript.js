// ============== FIREBASE CONFIGURATION ==============
// IMPORTANT: Replace this with your actual Firebase config
const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id-here"
};

// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile 
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs 
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables for budget calculations
let activityCount = 0;
let otherCostCount = 0;
let lodgingCount = 1;
let currentUser = null;

// ============== AUTHENTICATION ==============
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            showBudgetTool(user);
        } else {
            currentUser = null;
            showLoginForm();
        }
    });

    // Login/Signup form toggles
    document.getElementById('showSignup').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
        hideError();
    });

    document.getElementById('showLogin').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
        hideError();
    });

    // Login form submission
    document.getElementById('loginFormElement').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            showLoading();
            await signInWithEmailAndPassword(auth, email, password);
            // User will be redirected by onAuthStateChanged
        } catch (error) {
            hideLoading();
            showError(getErrorMessage(error.code));
        }
    });

    // Signup form submission
    document.getElementById('signupFormElement').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        // Validate school email (optional)
        if (!email.includes('@dawsonschool.org') && !email.includes('@gmail.com')) {
            showError('Please use your school email address');
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters long');
            return;
        }

        try {
            showLoading();
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            // Update user profile with name
            await updateProfile(userCredential.user, {
                displayName: name
            });

            // Create user document in Firestore
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                name: name,
                email: email,
                role: 'teacher',
                createdAt: new Date()
            });

            // User will be redirected by onAuthStateChanged
        } catch (error) {
            hideLoading();
            showError(getErrorMessage(error.code));
        }
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await signOut(auth);
            // User will be redirected by onAuthStateChanged
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
});

function showLoginForm() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('budgetTool').style.display = 'none';
}

function showBudgetTool(user) {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('budgetTool').style.display = 'block';
    
    // Display user name
    const displayName = user.displayName || user.email.split('@')[0];
    document.getElementById('userName').textContent = displayName;
    
    // Initialize budget tool
    initializeBudgetTool();
    loadUserBudget();
}

function showError(message) {
    const errorDiv = document.getElementById('authError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function hideError() {
    document.getElementById('authError').style.display = 'none';
}

function showLoading() {
    // You can implement a loading spinner here
    const buttons = document.querySelectorAll('.auth-btn');
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.textContent = 'Loading...';
    });
}

function hideLoading() {
    const buttons = document.querySelectorAll('.auth-btn');
    buttons.forEach(btn => {
        btn.disabled = false;
    });
    document.querySelector('#loginFormElement .auth-btn').textContent = 'Login';
    document.querySelector('#signupFormElement .auth-btn').textContent = 'Create Account';
}

function getErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/user-not-found':
            return 'No account found with this email address';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters';
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later';
        default:
            return 'An error occurred. Please try again';
    }
}

// ============== BUDGET TOOL FUNCTIONALITY ==============
function initializeBudgetTool() {
    calculateTotals();
    
    // Add event listeners for buttons
    document.getElementById('add-activity-btn').addEventListener('click', addActivity);
    document.getElementById('add-lodging-btn').addEventListener('click', addLodging);
    document.getElementById('add-other-cost-btn').addEventListener('click', addOtherCost);
    
    // Add save and submit functionality
    document.getElementById('saveDraftBtn').addEventListener('click', saveBudget);
    document.getElementById('submitBtn').addEventListener('click', submitBudget);
}

function calculateTotals() {
    const duration = parseInt(document.getElementById('duration').value) || 5;
    const numStudents = parseInt(document.getElementById('numStudents').value) || 12;
    const numTeachers = parseInt(document.getElementById('numTeachers').value) || 2;
    const groupSize = numStudents + numTeachers;
    
    // Transportation
    const airfareInput = parseFloat(document.getElementById('airfare').value) || 0;
    const airfareType = document.getElementById('airfareType').value;
    const groundTransport = parseFloat(document.getElementById('groundTransport').value) || 0;
    const rentalCarInput = parseFloat(document.getElementById('rentalCar').value) || 0;
    const rentalCarType = document.getElementById('rentalCarType').value;
    
    const totalAirfare = airfareType === 'perperson' ? airfareInput * groupSize : airfareInput;
    const rentalCar = rentalCarType === 'perday' ? rentalCarInput * duration : rentalCarInput;
    
    const totalGroundTransport = groundTransport * groupSize;
    const totalTransportation = totalAirfare + totalGroundTransport + rentalCar;
    
    // Update transportation display
    if (airfareType === 'perperson') {
        document.getElementById('airfare-total').textContent = `${groupSize} people × $${airfareInput.toLocaleString()} = $${totalAirfare.toLocaleString()}`;
    } else {
        document.getElementById('airfare-total').textContent = `Total: $${totalAirfare.toLocaleString()}`;
    }
    
    document.getElementById('ground-total').textContent = `Total: $${totalGroundTransport.toLocaleString()}`;
    
    if (rentalCarType === 'perday') {
        document.getElementById('rental-total').textContent = `${duration} days × $${rentalCarInput.toLocaleString()} = $${rentalCar.toLocaleString()}`;
    } else {
        document.getElementById('rental-total').textContent = `Total: $${rentalCar.toLocaleString()}`;
    }
    
    document.getElementById('transportation-total').textContent = `$${totalTransportation.toLocaleString()}`;
    
    // Lodging
    let totalLodging = 0;
    for (let i = 0; i < lodgingCount; i++) {
        const costEl = document.getElementById(`lodging-cost-${i}`);
        const nightsEl = document.getElementById(`lodging-nights-${i}`);
        const totalEl = document.getElementById(`lodging-total-${i}`);
        
        if (costEl && nightsEl && totalEl) {
            const cost = parseFloat(costEl.value) || 0;
            const nights = parseInt(nightsEl.value) || 0;
            const lodgingTotal = cost * nights;
            totalLodging += lodgingTotal;
            totalEl.textContent = `$${lodgingTotal.toLocaleString()}`;
        }
    }
    document.getElementById('lodging-total').textContent = `$${totalLodging.toLocaleString()}`;
    
    // Food
    const breakfast = parseFloat(document.getElementById('breakfast').value) || 12;
    const lunch = parseFloat(document.getElementById('lunch').value) || 18;
    const dinner = parseFloat(document.getElementById('dinner').value) || 25;
    const totalFood = (breakfast + lunch + dinner) * groupSize * duration;
    
    document.getElementById('food-calc').textContent = `$${breakfast + lunch + dinner}/person/day × ${groupSize} people × ${duration} days`;
    document.getElementById('food-total').textContent = `$${totalFood.toLocaleString()}`;
    
    // Activities
    let totalActivities = 0;
    for (let i = 0; i < activityCount; i++) {
        const costEl = document.getElementById(`activity-cost-${i}`);
        const perPersonEl = document.getElementById(`activity-perperson-${i}`);
        const totalEl = document.getElementById(`activity-total-${i}`);
        
        if (costEl && perPersonEl && totalEl) {
            const cost = parseFloat(costEl.value) || 0;
            const perPerson = perPersonEl.value === 'true';
            const activityTotal = perPerson ? cost * groupSize : cost;
            totalActivities += activityTotal;
            totalEl.textContent = `$${activityTotal.toLocaleString()}`;
        }
    }
    document.getElementById('activities-total').textContent = `$${totalActivities.toLocaleString()}`;
    
    // Other costs
    let totalOtherCosts = 0;
    for (let i = 0; i < otherCostCount; i++) {
        const amountEl = document.getElementById(`other-amount-${i}`);
        if (amountEl) {
            totalOtherCosts += parseFloat(amountEl.value) || 0;
        }
    }
    document.getElementById('other-total').textContent = `$${totalOtherCosts.toLocaleString()}`;
    
    // Subtotal and fees
    const subtotal = totalTransportation + totalLodging + totalFood + totalActivities + totalOtherCosts;
    const creditCardFeePercent = parseFloat(document.getElementById('creditCardFee').value) || 3;
    const creditCardFeeAmount = subtotal * (creditCardFeePercent / 100);
    const contingencyInput = parseFloat(document.getElementById('contingency').value);
    const contingencyAmount = contingencyInput || (subtotal * 0.1);
    
    document.getElementById('creditcard-calc').textContent = `${creditCardFeePercent}% of subtotal: $${creditCardFeeAmount.toLocaleString()}`;
    
    if (contingencyInput) {
        document.getElementById('contingency-calc').textContent = `Custom: $${contingencyAmount.toLocaleString()}`;
    } else {
        document.getElementById('contingency-calc').textContent = `10% default: $${contingencyAmount.toLocaleString()}`;
    }
    
    const grandTotal = subtotal + creditCardFeeAmount + contingencyAmount;
    const pricePerStudent = grandTotal / numStudents;
    
    // Update summary
    document.getElementById('summary-transportation').textContent = `$${totalTransportation.toLocaleString()}`;
    document.getElementById('summary-lodging').textContent = `$${totalLodging.toLocaleString()}`;
    document.getElementById('summary-food').textContent = `$${totalFood.toLocaleString()}`;
    document.getElementById('summary-activities').textContent = `$${totalActivities.toLocaleString()}`;
    document.getElementById('summary-other').textContent = `$${totalOtherCosts.toLocaleString()}`;
    document.getElementById('summary-subtotal').textContent = `$${subtotal.toLocaleString()}`;
    document.getElementById('summary-creditcard').textContent = `$${creditCardFeeAmount.toLocaleString()}`;
    document.getElementById('summary-contingency').textContent = `$${contingencyAmount.toLocaleString()}`;
    document.getElementById('summary-total').textContent = `$${grandTotal.toLocaleString()}`;
    document.getElementById('price-per-student').textContent = `$${Math.round(pricePerStudent)}`;
    
    // Update group breakdown
    document.getElementById('group-breakdown').textContent = `Total group: ${numStudents} students + ${numTeachers} teachers = ${groupSize} people`;
}

function addLodging() {
    const container = document.getElementById('lodging-container');
    
    const lodgingDiv = document.createElement('div');
    lodgingDiv.className = 'item-row';
    lodgingDiv.innerHTML = `
        <div class="form-group">
            <label>Hotel ${lodgingCount + 1} Name</label>
            <input type="text" id="lodging-name-${lodgingCount}" placeholder="Hotel name">
        </div>
        <div class="form-group">
            <label>Cost per night</label>
            <input type="number" id="lodging-cost-${lodgingCount}" value="0" oninput="calculateTotals()" placeholder="Amount">
        </div>
        <div class="form-group">
            <label>Number of nights</label>
            <input type="number" id="lodging-nights-${lodgingCount}" value="0" min="0" oninput="calculateTotals()">
        </div>
        <div class="form-group">
            <label>Source</label>
            <input type="text" id="lodging-source-${lodgingCount}" placeholder="e.g., Booking.com, hotel direct">
        </div>
        <div class="total-display">
            <strong id="lodging-total-${lodgingCount}">$0</strong>
            <button class="remove-button" onclick="removeLodging(${lodgingCount})">Remove</button>
        </div>
    `;
    
    container.appendChild(lodgingDiv);
    lodgingCount++;
    calculateTotals();
}

function removeLodging(id) {
    const lodgingDiv = document.getElementById(`lodging-name-${id}`).closest('.item-row');
    lodgingDiv.remove();
    calculateTotals();
}

function addActivity() {
    const container = document.getElementById('activities-container');
    if (container.children.length === 1 && container.children[0].classList.contains('empty-state')) {
        container.innerHTML = '';
    }
    
    const activityDiv = document.createElement('div');
    activityDiv.className = 'item-row';
    activityDiv.innerHTML = `
        <div class="form-group">
            <label>Activity Name</label>
            <input type="text" id="activity-name-${activityCount}" placeholder="Museum entrance, tour guide, etc.">
        </div>
        <div class="form-group">
            <label>Cost</label>
            <input type="number" id="activity-cost-${activityCount}" value="0" oninput="calculateTotals()" placeholder="Amount">
        </div>
        <div class="form-group">
            <label>Source</label>
            <input type="text" id="activity-source-${activityCount}" placeholder="e.g., museum website, tour company">
        </div>
        <div class="form-group">
            <label>Cost Type</label>
            <select id="activity-perperson-${activityCount}" onchange="calculateTotals()">
                <option value="true">Per Person</option>
                <option value="false">Total</option>
            </select>
        </div>
        <div class="total-display">
            <strong id="activity-total-${activityCount}">$0</strong>
            <button class="remove-button" onclick="removeActivity(${activityCount})">Remove</button>
        </div>
    `;
    
    container.appendChild(activityDiv);
    activityCount++;
    calculateTotals();
}

function removeActivity(id) {
    const activityDiv = document.getElementById(`activity-name-${id}`).closest('.item-row');
    activityDiv.remove();
    
    const container = document.getElementById('activities-container');
    if (container.children.length === 0) {
        container.innerHTML = '<div class="empty-state">No activities added yet. Click "Add Activity" to get started.</div>';
    }
    
    calculateTotals();
}

function addOtherCost() {
    const container = document.getElementById('other-costs-container');
    if (container.children.length === 1 && container.children[0].classList.contains('empty-state')) {
        container.innerHTML = '';
    }
    
    const costDiv = document.createElement('div');
    costDiv.className = 'item-row';
    costDiv.style.gridTemplateColumns = '2fr 1fr 1fr auto';
    costDiv.innerHTML = `
        <div class="form-group">
            <label>Description</label>
            <input type="text" id="other-desc-${otherCostCount}" placeholder="Visas, insurance, tips, etc.">
        </div>
        <div class="form-group">
            <label>Amount</label>
            <input type="number" id="other-amount-${otherCostCount}" value="0" oninput="calculateTotals()" placeholder="Amount">
        </div>
        <div class="form-group">
            <label>Source</label>
            <input type="text" id="other-source-${otherCostCount}" placeholder="Where quoted from">
        </div>
        <div class="total-display">
            <button class="remove-button" onclick="removeOtherCost(${otherCostCount})">Remove</button>
        </div>
    `;
    
    container.appendChild(costDiv);
    otherCostCount++;
    calculateTotals();
}

function removeOtherCost(id) {
    const costDiv = document.getElementById(`other-desc-${id}`).closest('.item-row');
    costDiv.remove();
    
    const container = document.getElementById('other-costs-container');
    if (container.children.length === 0) {
        container.innerHTML = '<div class="empty-state">No other costs added. Visas, insurance, tips, etc.</div>';
    }
    
    calculateTotals();
}

// ============== SAVE & SUBMIT FUNCTIONS ==============
async function saveBudget() {
    if (!currentUser) return;
    
    const budgetData = collectBudgetData();
    budgetData.status = 'draft';
    budgetData.lastModified = new Date();
    
    try {
        await setDoc(doc(db, 'budgets', currentUser.uid), budgetData);
        alert('Budget saved successfully!');
    } catch (error) {
        console.error('Error saving budget:', error);
        alert('Error saving budget. Please try again.');
    }
}

async function submitBudget() {
    if (!currentUser) return;
    
    const budgetData = collectBudgetData();
    budgetData.status = 'submitted';
    budgetData.submittedAt = new Date();
    
    try {
        // Save to user's budget document
        await setDoc(doc(db, 'budgets', currentUser.uid), budgetData);
        
        // Also add to submissions collection for director review
        await addDoc(collection(db, 'submissions'), {
            ...budgetData,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: currentUser.displayName || currentUser.email
        });
        
        alert('Budget submitted for director review!');
    } catch (error) {
        console.error('Error submitting budget:', error);
        alert('Error submitting budget. Please try again.');
    }
}

function collectBudgetData() {
    const data = {
        tripInfo: {
            tripName: document.getElementById('tripName').value,
            teacher1: document.getElementById('teacher1').value,
            teacher2: document.getElementById('teacher2').value,
            destination: document.getElementById('destination').value,
            duration: parseInt(document.getElementById('duration').value),
            numStudents: parseInt(document.getElementById('numStudents').value),
            numTeachers: parseInt(document.getElementById('numTeachers').value)
        },
        transportation: {
            airfare: parseFloat(document.getElementById('airfare').value) || 0,
            airfareSource: document.getElementById('airfare-source').value,
            airfareType: document.getElementById('airfareType').value,
            groundTransport: parseFloat(document.getElementById('groundTransport').value) || 0,
            groundTransportSource: document.getElementById('groundTransport-source').value,
            rentalCar: parseFloat(document.getElementById('rentalCar').value) || 0,
            rentalCarSource: document.getElementById('rentalCar-source').value,
            rentalCarType: document.getElementById('rentalCarType').value
        },
        lodging: [],
        food: {
            breakfast: parseFloat(document.getElementById('breakfast').value) || 12,
            lunch: parseFloat(document.getElementById('lunch').value) || 18,
            dinner: parseFloat(document.getElementById('dinner').value) || 25
        },
        activities: [],
        otherCosts: [],
        fees: {
            creditCardFee: parseFloat(document.getElementById('creditCardFee').value) || 3,
            contingency: parseFloat(document.getElementById('contingency').value) || 0
        }
    };
    
    // Collect lodging data
    for (let i = 0; i < lodgingCount; i++) {
        const nameEl = document.getElementById(`lodging-name-${i}`);
        const costEl = document.getElementById(`lodging-cost-${i}`);
        const nightsEl = document.getElementById(`lodging-nights-${i}`);
        const sourceEl = document.getElementById(`lodging-source-${i}`);
        
        if (nameEl && costEl && nightsEl && sourceEl) {
            data.lodging.push({
                name: nameEl.value,
                cost: parseFloat(costEl.value) || 0,
                nights: parseInt(nightsEl.value) || 0,
                source: sourceEl.value
            });
        }
    }
    
    // Collect activities data
    for (let i = 0; i < activityCount; i++) {
        const nameEl = document.getElementById(`activity-name-${i}`);
        const costEl = document.getElementById(`activity-cost-${i}`);
        const sourceEl = document.getElementById(`activity-source-${i}`);
        const perPersonEl = document.getElementById(`activity-perperson-${i}`);
        
        if (nameEl && costEl && sourceEl && perPersonEl) {
            data.activities.push({
                name: nameEl.value,
                cost: parseFloat(costEl.value) || 0,
                source: sourceEl.value,
                perPerson: perPersonEl.value === 'true'
            });
        }
    }
    
    // Collect other costs data
    for (let i = 0; i < otherCostCount; i++) {
        const descEl = document.getElementById(`other-desc-${i}`);
        const amountEl = document.getElementById(`other-amount-${i}`);
        const sourceEl = document.getElementById(`other-source-${i}`);
        
        if (descEl && amountEl && sourceEl) {
            data.otherCosts.push({
                description: descEl.value,
                amount: parseFloat(amountEl.value) || 0,
                source: sourceEl.value
            });
        }
    }
    
    return data;
}

async function loadUserBudget() {
    if (!currentUser) return;
    
    try {
        const docRef = doc(db, 'budgets', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            populateBudgetForm(data);
        }
    } catch (error) {
        console.error('Error loading budget:', error);
    }
}

function populateBudgetForm(data) {
    // Populate trip info
    if (data.tripInfo) {
        document.getElementById('tripName').value = data.tripInfo.tripName || '';
        document.getElementById('teacher1').value = data.tripInfo.teacher1 || '';
        document.getElementById('teacher2').value = data.tripInfo.teacher2 || '';
        document.getElementById('destination').value = data.tripInfo.destination || '';
        document.getElementById('duration').value = data.tripInfo.duration || 5;
        document.getElementById('numStudents').value = data.tripInfo.numStudents || 12;
        document.getElementById('numTeachers').value = data.tripInfo.numTeachers || 2;
    }
    
    // Populate transportation
    if (data.transportation) {
        document.getElementById('airfare').value = data.transportation.airfare || 0;
        document.getElementById('airfare-source').value = data.transportation.airfareSource || '';
        document.getElementById('airfareType').value = data.transportation.airfareType || 'perperson';
        document.getElementById('groundTransport').value = data.transportation.groundTransport || 0;
        document.getElementById('groundTransport-source').value = data.transportation.groundTransportSource || '';
        document.getElementById('rentalCar').value = data.transportation.rentalCar || 0;
        document.getElementById('rentalCar-source').value = data.transportation.rentalCarSource || '';
        document.getElementById('rentalCarType').value = data.transportation.rentalCarType || 'total';
    }
    
    // Populate food
    if (data.food) {
        document.getElementById('breakfast').value = data.food.breakfast || 12;
        document.getElementById('lunch').value = data.food.lunch || 18;
        document.getElementById('dinner').value