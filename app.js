document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyDW7TKfnNLV46XHF3FKTTwXfnZWrr0q7pE",
        authDomain: "controle-gastos-edd28.firebaseapp.com",
        projectId: "controle-gastos-edd28",
        storageBucket: "controle-gastos-edd28.firebasestorage.app",
        messagingSenderId: "503219165241",
        appId: "1:503219165241:web:499ad10d1a1cb0ff5015e8"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    // --- FIM DA CONFIGURAÇÃO ---


    // --- VARIÁVEIS DE ESTADO ---
    let currentMonthData = {}; // Guarda os dados do MÊS ATUAL
    let dbCollectionPath = null; // Caminho de base no DB (ex: db.collection('users').doc('USER_ID'))
    let allTimeInvestmentCache = 0; 

    let currentMonthKey = '';
    let isEditing = { status: false, id: null, type: null };
    const today = new Date();
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    // --- SELETORES DE UI ---
    
    // UI de Autenticação
    const loginContainer = document.getElementById('login-container');
    const appWrapper = document.getElementById('app-wrapper');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfoEl = document.getElementById('user-info');
    
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const nameLoginForm = document.getElementById('name-login-form');
    const userNameInput = document.getElementById('user-name-input');
    
    // Botões de alternância
    const showRegisterBtn = document.getElementById('show-register-btn');
    const showPublicLoginBtn = document.getElementById('show-public-login-btn');
    const showLoginFromRegisterBtn = document.getElementById('show-login-from-register-btn');
    const showPrivateLoginBtn = document.getElementById('show-private-login-btn');

    // Erros
    const loginErrorEl = document.getElementById('login-error');
    const registerErrorEl = document.getElementById('register-error');
    
    // UI da Aplicação
    const monthSelector = document.getElementById('month-selector');
    const totalIncomeEl = document.getElementById('total-income');
    const totalDailyExpenseEl = document.getElementById('total-daily-expense');
    const totalProjectedExpenseEl = document.getElementById('total-projected-expense');
    const netBalanceEl = document.getElementById('net-balance');
    const dailyExpensesList = document.getElementById('daily-expenses-list');
    const projectedExpensesList = document.getElementById('projected-expenses-list');
    const gainsList = document.getElementById('gains-list');
    const totalInvestedMonthEl = document.getElementById('total-invested-month');
    const totalInvestedAllTimeEl = document.getElementById('total-invested-all-time');
    
    const addIncomeBtn = document.getElementById('add-income-btn');
    const addExpenseBtn = document.getElementById('add-expense-btn');
    const addInvestmentBtn = document.getElementById('add-investment-btn');
    
    const incomeModal = document.getElementById('income-modal');
    const expenseModal = document.getElementById('expense-modal');
    const investmentModal = document.getElementById('investment-modal');
    
    const closeIncomeModal = document.getElementById('close-income-modal');
    const closeExpenseModal = document.getElementById('close-expense-modal');
    const closeInvestmentModal = document.getElementById('close-investment-modal');
    
    const incomeForm = document.getElementById('income-form');
    const expenseForm = document.getElementById('expense-form');
    const investmentForm = document.getElementById('investment-form');
    
    const expenseTypeRadios = document.querySelectorAll('input[name="expense-type"]');
    const expenseInstallmentsGroup = document.getElementById('expense-installments-group');
    const expenseTotalAmountGroup = document.getElementById('expense-total-amount-group');
    const expenseInstallmentsInput = document.getElementById('expense-installments');
    const expenseInstallmentValuesContainer = document.getElementById('expense-installment-values-container');
    const expenseAmountInput = document.getElementById('expense-amount');
    
    const investmentTypeRadios = document.querySelectorAll('input[name="investment-type"]');
    const investmentInstallmentsGroup = document.getElementById('investment-installments-group');
    const investmentTotalAmountGroup = document.getElementById('investment-total-amount-group');
    const investmentInstallmentsInput = document.getElementById('investment-installments');
    const investmentInstallmentValuesContainer = document.getElementById('investment-installment-values-container');
    const investmentAmountInput = document.getElementById('investment-amount');


    // --- FUNÇÕES DE AUTENTICAÇÃO ---

    function handleRegister(e) {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Sucesso. O 'initAuth' (onAuthStateChanged) vai lidar com a exibição do app.
                registerErrorEl.classList.add('hidden');
            })
            .catch((error) => showAuthError(error, registerErrorEl));
    }

    function handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Sucesso. O 'initAuth' (onAuthStateChanged) vai lidar com a exibição do app.
                loginErrorEl.classList.add('hidden');
            })
            .catch((error) => showAuthError(error, loginErrorEl));
    }

    // Login Rápido/Público
    async function handleNameLogin(e) {
        e.preventDefault();
        const name = userNameInput.value;
        if (!name || name.trim().length === 0) return;
        
        const userName = name.trim();

        // 1. Faz login anônimo
        try {
            await auth.signInAnonymously();
            // 2. Define o caminho público
            dbCollectionPath = db.collection('public_budgets').doc(userName);
            // 3. Salva o nome para "lembrar"
            localStorage.setItem('lastPublicName', userName);
            // 4. Mostra o app
            showApp(`Usuário (Público): ${userName}`);
        } catch (error) {
            console.error("Erro no login anônimo:", error);
            showAuthError({ code: "auth/internal-error" }, loginErrorEl);
        }
    }

    function handleLogout() {
        auth.signOut().catch((error) => console.error("Erro no logout: ", error));
    }

    function showAuthError(error, element) {
        let message = "Ocorreu um erro. Tente novamente.";
        switch (error.code) {
            case "auth/wrong-password": message = "Senha incorreta. Tente novamente."; break;
            case "auth/user-not-found": message = "Nenhum usuário encontrado com este email."; break;
            case "auth/email-already-in-use": message = "Este email já está em uso. Tente fazer login."; break;
            case "auth/weak-password": message = "Sua senha é muito fraca. Use pelo menos 6 caracteres."; break;
            case "auth/invalid-email": message = "Email inválido."; break;
            case "auth/internal-error": message = "Erro de conexão. Tente novamente."; break;
        }
        element.textContent = message;
        element.classList.remove('hidden');
    }

    // Observador principal do Firebase Auth
    function initAuth() {
        auth.onAuthStateChanged(user => {
            if (user && !user.isAnonymous) {
                // --- USUÁRIO PRIVADO (EMAIL) LOGADO ---
                dbCollectionPath = db.collection('users').doc(user.uid);
                localStorage.removeItem('lastPublicName'); // Limpa o nome público
                showApp(`Usuário: ${user.email}`);

            } else if (user && user.isAnonymous) {
                // --- USUÁRIO ANÔNIMO LOGADO ---
                // Verifica se ele estava logado com um nome público antes
                const lastPublicName = localStorage.getItem('lastPublicName');
                if (lastPublicName) {
                    dbCollectionPath = db.collection('public_budgets').doc(lastPublicName);
                    showApp(`Usuário (Público): ${lastPublicName}`);
                } else {
                    // Logado anonimamente, mas sem nome público. Mostra a tela de login.
                    showLogin();
                }
            } else {
                // --- NINGUÉM LOGADO ---
                dbCollectionPath = null;
                currentMonthData = {};
                allTimeInvestmentCache = 0;
                localStorage.removeItem('lastPublicName'); // Limpa o nome público
                showLogin();
            }
        });
    }

    async function showApp(userInfoText) {
        loginContainer.classList.add('hidden');
        appWrapper.classList.remove('hidden');
        userInfoEl.textContent = userInfoText;

        // Inicializa o app
        populateMonthSelector();
        await loadDatabase(); // Espera carregar os dados
        updateUI(); 
    }

    function showLogin() {
        appWrapper.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        userInfoEl.textContent = '';
        
        // Reseta todos os formulários de login
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        nameLoginForm.classList.add('hidden');
        loginErrorEl.classList.add('hidden');
        registerErrorEl.classList.add('hidden');
    }

    // --- FUNÇÕES PRINCIPAIS DO APP (com Firestore) ---

    function formatCurrency(value) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function getMonthKey(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    }

    function getMonthData() {
        // Retorna um objeto de mês vazio
        return {
            income: [],
            dailyExpenses: [],
            projectedExpenses: []
        };
    }
    
    // Salva os dados do MÊS ATUAL no Firestore
    async function saveDatabase() {
        if (!dbCollectionPath || !currentMonthKey) return; 

        // Usa o caminho de coleção definido (privado ou público) e salva o mês
        const docRef = dbCollectionPath.collection('months').doc(currentMonthKey);
        try {
            // Garante que os arrays existam antes de salvar
            if (!currentMonthData.income) currentMonthData.income = [];
            if (!currentMonthData.dailyExpenses) currentMonthData.dailyExpenses = [];
            if (!currentMonthData.projectedExpenses) currentMonthData.projectedExpenses = [];
            
            await docRef.set(currentMonthData);
        } catch (error) {
            console.error("Erro ao salvar dados: ", error);
        }
    }

    // Carrega os dados do MÊS ATUAL do Firestore
    async function loadDatabase() {
        if (!dbCollectionPath) {
            currentMonthData = getMonthData();
            return;
        }

        const docRef = dbCollectionPath.collection('months').doc(currentMonthKey);
        const doc = await docRef.get();

        if (doc.exists) {
            currentMonthData = doc.data();
            // Garante que os arrays existam após carregar
            if (!currentMonthData.income) currentMonthData.income = [];
            if (!currentMonthData.dailyExpenses) currentMonthData.dailyExpenses = [];
            if (!currentMonthData.projectedExpenses) currentMonthData.projectedExpenses = [];
        } else {
            currentMonthData = getMonthData();
        }
        
        // Recalcula o total de investimento
        await calculateTotalInvestedAllTime();
    }

    // Calcula o total de investimento de TODOS OS MESES
    async function calculateTotalInvestedAllTime() {
        if (!dbCollectionPath) {
            allTimeInvestmentCache = 0;
            return;
        }

        const monthsRef = dbCollectionPath.collection('months');
        const snapshot = await monthsRef.get();

        let total = 0;
        snapshot.forEach(doc => {
            const monthData = doc.data();
            const daily = (monthData.dailyExpenses || [])
                .filter(item => item.category === 'investimentos')
                .reduce((sum, item) => sum + item.amount, 0);
            
            const projected = (monthData.projectedExpenses || [])
                .filter(item => item.category === 'investimentos')
                .reduce((sum, item) => sum + item.amount, 0);
            
            total += daily + projected;
        });
        
        allTimeInvestmentCache = total;
    }

    // Atualiza o cache
    function updateInvestedAllTime(amount) {
        allTimeInvestmentCache += amount;
        totalInvestedAllTimeEl.textContent = formatCurrency(allTimeInvestmentCache);
    }

    function populateMonthSelector() {
        monthSelector.innerHTML = '';
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        for (let i = -12; i <= 12; i++) {
            const date = new Date(currentYear, currentMonth + i, 1);
            const key = getMonthKey(date);
            const monthName = monthNames[date.getMonth()];
            const year = date.getFullYear();

            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${monthName} / ${year}`;
            
            monthSelector.appendChild(option);
        }
        currentMonthKey = getMonthKey(today);
        monthSelector.value = currentMonthKey;
    }

    // Atualiza a UI com os dados do 'currentMonthData'
    function updateUI() {
        const data = currentMonthData; // Pega os dados do mês atual
        if (!data) return; 
        
        const totalIncome = (data.income || []).reduce((sum, item) => sum + item.amount, 0);
        const totalDaily = (data.dailyExpenses || []).filter(item => item.category !== 'investimentos').reduce((sum, item) => sum + item.amount, 0);
        const totalProjected = (data.projectedExpenses || []).filter(item => item.category !== 'investimentos').reduce((sum, item) => sum + item.amount, 0);
        const totalInvestedDaily = (data.dailyExpenses || []).filter(item => item.category === 'investimentos').reduce((sum, item) => sum + item.amount, 0);
        const totalInvestedProjected = (data.projectedExpenses || []).filter(item => item.category === 'investimentos').reduce((sum, item) => sum + item.amount, 0);
        const totalInvestedMonth = totalInvestedDaily + totalInvestedProjected;
        const netBalance = totalIncome - totalDaily - totalProjected - totalInvestedMonth;
        
        totalIncomeEl.textContent = formatCurrency(totalIncome);
        totalDailyExpenseEl.textContent = formatCurrency(totalDaily);
        totalProjectedExpenseEl.textContent = formatCurrency(totalProjected);
        netBalanceEl.textContent = formatCurrency(netBalance);
        totalInvestedMonthEl.textContent = formatCurrency(totalInvestedMonth); 
        totalInvestedAllTimeEl.textContent = formatCurrency(allTimeInvestmentCache); 

        if (netBalance > 0) {
            netBalanceEl.classList.remove('negative');
            netBalanceEl.classList.add('positive');
        } else if (netBalance < 0) {
            netBalanceEl.classList.remove('positive');
            netBalanceEl.classList.add('negative');
        } else {
            netBalanceEl.classList.remove('positive', 'negative');
        }
        
        dailyExpensesList.innerHTML = '';
        if (!data.dailyExpenses || data.dailyExpenses.length === 0) {
            dailyExpensesList.innerHTML = '<li class="empty-list">Nenhum gasto diário este mês.</li>';
        } else {
            data.dailyExpenses.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(item => {
                const li = createListItem(item.description, item.amount, item.category, item.id, 'daily', item.date);
                dailyExpensesList.appendChild(li);
            });
        }
        
        projectedExpensesList.innerHTML = '';
        if (!data.projectedExpenses || data.projectedExpenses.length === 0) {
            projectedExpensesList.innerHTML = '<li class="empty-list">Nenhum gasto previsto este mês.</li>';
        } else {
            data.projectedExpenses.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(item => {
                const li = createListItem(item.description, item.amount, item.category, item.id, 'projected', item.date);
                projectedExpensesList.appendChild(li);
            });
        }
        
        gainsList.innerHTML = '';
        if (!data.income || data.income.length === 0) {
            gainsList.innerHTML = '<li class="empty-list">Nenhum ganho este mês.</li>';
        } else {
            data.income.forEach(item => {
                const li = createListItem(item.description, item.amount, 'income', item.id, 'income', null);
                gainsList.appendChild(li);
            });
        }
    }
    
    // Cria o item da lista
    function createListItem(description, amount, category, id, type, date) {
        const li = document.createElement('li');
        li.className = 'list-item';
        
        const itemDetailsDiv = document.createElement('div');
        itemDetailsDiv.className = 'item-details';
        const descSpan = document.createElement('span');
        descSpan.className = 'description';
        descSpan.textContent = description;
        itemDetailsDiv.appendChild(descSpan); 

        if (date && type !== 'income') {
            const dateSpan = document.createElement('span');
            dateSpan.className = 'list-item-date';
            // Proteção para data inválida (caso algum dado antigo não tenha)
            if (date.includes('-')) { 
                const [year, month, day] = date.split('-');
                dateSpan.textContent = `${day}/${month}/${year}`;
            } else {
                dateSpan.textContent = date; // fallback
            }
            itemDetailsDiv.appendChild(dateSpan); 
        }

        const amountActionsDiv = document.createElement('div');
        amountActionsDiv.className = 'amount-actions';
        const amountSpan = document.createElement('span');
        amountSpan.className = 'amount';
        if (category === 'investimentos') amountSpan.classList.add('invested');
        else if (category === 'income') amountSpan.classList.add('positive');
        amountSpan.textContent = formatCurrency(amount);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn';
        editBtn.innerHTML = '&#9998;';
        editBtn.title = 'Editar';
        editBtn.addEventListener('click', () => handleEditItem(id, type));
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn';
        deleteBtn.innerHTML = '&#128465;';
        deleteBtn.title = 'Excluir';
        deleteBtn.addEventListener('click', () => handleDeleteItem(id, type));

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        amountActionsDiv.appendChild(amountSpan);
        amountActionsDiv.appendChild(actionsDiv);
        li.appendChild(itemDetailsDiv); 
        li.appendChild(amountActionsDiv); 
        return li;
    }

    // Gera inputs de parcelas
    function generateInstallmentInputs(count, container, prefix) {
        container.innerHTML = '';
        if (count > 60) count = 60;
        if (count < 1) count = 1;

        for (let i = 1; i <= count; i++) {
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';
            const label = document.createElement('label');
            label.htmlFor = `${prefix}-installment-value-${i}`;
            label.textContent = `Valor Parcela ${i}:`;
            const input = document.createElement('input');
            input.type = 'number';
            input.id = `${prefix}-installment-value-${i}`;
            input.className = 'installment-value';
            input.placeholder = '100,00';
            input.step = '0.01';
            input.min = '0.01';
            input.required = true;
            formGroup.appendChild(label);
            formGroup.appendChild(input);
            container.appendChild(formGroup);
        }
    }

    // --- FUNÇÕES DE MODAL ---
    function showModal(modal) {
        modal.style.display = 'block';
    }
    
    function resetEditState() {
        isEditing = { status: false, id: null, type: null };
        expenseModal.querySelector('h2').textContent = 'Adicionar Gasto';
        expenseModal.querySelector('button[type="submit"]').textContent = 'Salvar Gasto';
        investmentModal.querySelector('h2').textContent = 'Adicionar Investimento';
        investmentModal.querySelector('button[type="submit"]').textContent = 'Salvar Investimento';
        incomeModal.querySelector('h2').textContent = 'Adicionar Ganho';
        incomeModal.querySelector('button[type="submit"]').textContent = 'Salvar Ganho';
        expenseForm.querySelectorAll('input[name="expense-type"]').forEach(radio => radio.disabled = false);
        expenseForm.querySelector('label[for="expense-category"]').style.display = 'block';
        expenseForm.querySelector('#expense-category').style.display = 'block';
        investmentForm.querySelectorAll('input[name="investment-type"]').forEach(radio => radio.disabled = false);
    }

    function hideModal(modal) {
        modal.style.display = 'none';
        incomeForm.reset();
        expenseForm.reset();
        investmentForm.reset();
        expenseInstallmentsGroup.style.display = 'none';
        expenseTotalAmountGroup.style.display = 'block';
        expenseAmountInput.required = true;
        expenseInstallmentValuesContainer.innerHTML = '';
        document.querySelector('input[name="expense-type"][value="daily"]').checked = true;
        document.getElementById('expense-category').value = 'outros';
        investmentInstallmentsGroup.style.display = 'none';
        investmentTotalAmountGroup.style.display = 'block';
        investmentAmountInput.required = true;
        investmentInstallmentValuesContainer.innerHTML = '';
        document.querySelector('input[name="investment-type"][value="daily"]').checked = true;
        resetEditState();
    }

    // --- HANDLERS DE FORMULÁRIO (CRUD) ---
    
    // Adiciona/Atualiza Renda
    async function handleIncomeSubmit(e) {
        e.preventDefault();
        if (isEditing.status && isEditing.type === 'income') {
            updateEditedIncome();
        } else {
            addNewIncome();
        }
        await saveDatabase(); 
        updateUI(); 
        hideModal(incomeModal);
    }

    function addNewIncome() {
        const description = document.getElementById('income-description').value;
        const amount = parseFloat(document.getElementById('income-amount').value);
        if (!description || isNaN(amount) || amount <= 0) return;
        const id = new Date().getTime().toString();
        
        if (!currentMonthData.income) currentMonthData.income = [];
        currentMonthData.income.push({ description, amount, id });
    }

    function updateEditedIncome() {
        const { id } = isEditing;
        const itemIndex = currentMonthData.income.findIndex(i => i.id === id);
        if (itemIndex === -1) return;
        const newDescription = document.getElementById('income-description').value;
        const newAmount = parseFloat(document.getElementById('income-amount').value);
        if (!newDescription || isNaN(newAmount) || newAmount <= 0) return;
        currentMonthData.income[itemIndex].description = newDescription;
        currentMonthData.income[itemIndex].amount = newAmount;
    }

    // Adiciona/Atualiza Gasto
    async function handleExpenseSubmit(e) {
        e.preventDefault();
        const type = expenseForm.querySelector('input[name="expense-type"]:checked').value;
        if (isEditing.status) {
            await updateEditedItem('expense');
        } else {
            await addNewTransaction('expense', type);
        }
        await saveDatabase(); // Salva o mês atual (que pode ter sido modificado)
        updateUI();
        hideModal(expenseModal);
    }

    // Adiciona/Atualiza Investimento
    async function handleInvestmentSubmit(e) {
        e.preventDefault();
        const type = investmentForm.querySelector('input[name="investment-type"]:checked').value;
        if (isEditing.status) {
            await updateEditedItem('investment');
        } else {
            await addNewTransaction('investment', type);
        }
        await saveDatabase(); // Salva o mês atual (que pode ter sido modificado)
        updateUI();
        hideModal(investmentModal);
    }
    
    // Função central para adicionar Gasto ou Investimento
    async function addNewTransaction(modalType, type) {
        if (!dbCollectionPath) return; // Proteção
        const form = (modalType === 'expense') ? expenseForm : investmentForm;
        const description = form.querySelector('input[type="text"]').value;
        
        let date = null;
        let selectedDate = null;
        let targetMonthKey = currentMonthKey;

        if (modalType === 'expense') {
            date = form.querySelector('#expense-date').value;
            if (!description || !date) return;
            selectedDate = new Date(date + 'T12:00:00'); 
            targetMonthKey = getMonthKey(selectedDate);
        } else {
            if (!description) return;
            selectedDate = new Date(new Date().toISOString().split('T')[0] + 'T12:00:00');
            date = selectedDate.toISOString().split('T')[0];
            targetMonthKey = getMonthKey(selectedDate);
        }

        const category = (modalType === 'expense') ? form.querySelector('#expense-category').value : 'investimentos';
        
        if (type === 'daily') {
            const amount = parseFloat(form.querySelector('input[type="number"]').value);
            if (isNaN(amount) || amount <= 0) return;
            const id = new Date().getTime().toString();
            
            // Se for em outro mês, precisamos carregar e salvar esse outro mês
            if (targetMonthKey !== currentMonthKey) {
                const otherMonthRef = dbCollectionPath.collection('months').doc(targetMonthKey);
                const doc = await otherMonthRef.get();
                const otherMonthData = doc.exists ? doc.data() : getMonthData();
                
                if (!otherMonthData.dailyExpenses) otherMonthData.dailyExpenses = [];
                otherMonthData.dailyExpenses.push({ description, amount, category, id, date });
                await otherMonthRef.set(otherMonthData); // Salva o outro mês
            } else {
                if (!currentMonthData.dailyExpenses) currentMonthData.dailyExpenses = [];
                currentMonthData.dailyExpenses.push({ description, amount, category, id, date });
                // saveDatabase() será chamado no final pelo handleExpenseSubmit
            }

            if (category === 'investimentos') updateInvestedAllTime(amount);
            
        } else if (type === 'recorrente') {
            const installments = parseInt(form.querySelector('input[id*="-installments"]').value) || 1;
            const installmentValueInputs = form.querySelectorAll('.installment-value');
            let allInstallmentsValid = true;
            const installmentValues = [];
            installmentValueInputs.forEach(input => {
                const value = parseFloat(input.value);
                if (isNaN(value) || value <= 0) allInstallmentsValid = false;
                installmentValues.push(value);
            });
            if (!allInstallmentsValid) return;
            
            const startDate = selectedDate;
            let totalInvestmentAmount = 0;

            for (let i = 0; i < installments; i++) {
                const targetDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
                const targetKey = getMonthKey(targetDate);
                const installmentDescription = `${description} (${i + 1}/${installments})`;
                const installmentAmount = installmentValues[i];
                const id = new Date().getTime().toString() + i;
                const installmentDate = targetDate.toISOString().split('T')[0];
                
                const installmentData = { description: installmentDescription, amount: installmentAmount, category, id, date: installmentDate };

                // *** INÍCIO DA CORREÇÃO DO BUG ***
                if (targetKey === currentMonthKey) {
                    // É o mês atual! Modifica o cache local (currentMonthData)
                    if (!currentMonthData.projectedExpenses) currentMonthData.projectedExpenses = [];
                    currentMonthData.projectedExpenses.push(installmentData);
                } else {
                    // É um mês futuro! Faz a operação normal de carregar/salvar
                    const docRef = dbCollectionPath.collection('months').doc(targetKey);
                    const doc = await docRef.get();
                    const monthData = doc.exists ? doc.data() : getMonthData();
                    
                    if (!monthData.projectedExpenses) monthData.projectedExpenses = [];
                    monthData.projectedExpenses.push(installmentData);
                    await docRef.set(monthData); // Salva o mês da parcela
                }
                // *** FIM DA CORREÇÃO DO BUG ***

                if (category === 'investimentos') totalInvestmentAmount += installmentAmount;
            }
            if (category === 'investimentos') updateInvestedAllTime(totalInvestmentAmount);
        }
    }

    // Atualiza Gasto ou Investimento
    async function updateEditedItem(modalType) {
        const { id, type } = isEditing;
        const list = (type === 'daily') ? currentMonthData.dailyExpenses : currentMonthData.projectedExpenses;
        const itemIndex = list.findIndex(i => i.id === id);
        if (itemIndex === -1) return;

        const form = (modalType === 'expense') ? expenseForm : investmentForm;
        const oldAmount = list[itemIndex].amount;
        const oldCategory = list[itemIndex].category;

        const newDescription = form.querySelector('input[type="text"]').value;
        const newAmount = parseFloat(form.querySelector('input[type="number"]').value);
        const newCategory = (modalType === 'expense') ? form.querySelector('#expense-category').value : 'investimentos';
        const newDate = (form.querySelector('input[type="date"]')) ? form.querySelector('input[type="date"]').value : list[itemIndex].date; 

        if (!newDescription || isNaN(newAmount) || newAmount <= 0 || !newDate) return;

        const newDateObj = new Date(newDate + 'T12:00:00');
        const newMonthKey = getMonthKey(newDateObj);

        if (newMonthKey !== currentMonthKey) {
            const itemToMove = { ...list[itemIndex], description: newDescription, amount: newAmount, category: newCategory, date: newDate };
            list.splice(itemIndex, 1); // Remove do mês antigo
            
            // Salva no novo mês
            const otherMonthRef = dbCollectionPath.collection('months').doc(newMonthKey);
            const doc = await otherMonthRef.get();
            const otherMonthData = doc.exists ? doc.data() : getMonthData();
            const targetList = (type === 'daily') ? otherMonthData.dailyExpenses : otherMonthData.projectedExpenses;
            if (!targetList) targetList = []; // Garante que o array exista
            targetList.push(itemToMove);
            await otherMonthRef.set(otherMonthData);

        } else {
            // Atualiza no mês atual
            list[itemIndex].description = newDescription;
            list[itemIndex].amount = newAmount;
            list[itemIndex].category = newCategory;
            list[itemIndex].date = newDate;
        }

        // Atualiza o total de investimento
        if(oldCategory === 'investimentos' && newCategory !== 'investimentos') {
            updateInvestedAllTime(-oldAmount);
        } else if (oldCategory !== 'investimentos' && newCategory === 'investimentos') {
            updateInvestedAllTime(newAmount);
        } else if (oldCategory === 'investimentos' && newCategory === 'investimentos') {
            updateInvestedAllTime(newAmount - oldAmount);
        }
    }

    // Abre modal de edição
    function handleEditItem(id, type) {
        isEditing = { status: true, id, type };
        const data = currentMonthData;

        if (type === 'income') {
            const item = data.income.find(i => i.id === id);
            if (!item) return;
            document.getElementById('income-description').value = item.description;
            document.getElementById('income-amount').value = item.amount;
            incomeModal.querySelector('h2').textContent = 'Editar Ganho';
            incomeModal.querySelector('button[type="submit"]').textContent = 'Salvar Alterações';
            showModal(incomeModal);
        } else {
            const list = (type === 'daily') ? data.dailyExpenses : data.projectedExpenses;
            const item = list.find(i => i.id === id);
            if (!item) return;
            const modal = (item.category === 'investimentos') ? investmentModal : expenseModal;
            const form = (item.category === 'investimentos') ? investmentForm : expenseForm;
            form.querySelector('input[type="text"]').value = item.description;
            form.querySelector('input[type="number"]').value = item.amount;
            if (form.querySelector('input[type="date"]')) {
                form.querySelector('input[type="date"]').value = item.date;
            }
            if(item.category !== 'investimentos') {
                form.querySelector('#expense-category').value = item.category;
            }
            form.querySelectorAll('input[type="radio"]').forEach(radio => radio.disabled = true);
            form.querySelector('input[type="radio"][value="daily"]').checked = true;
            form.querySelector('div[id*="-total-amount-group"]').style.display = 'block';
            form.querySelector('div[id*="-installments-group"]').style.display = 'none';
            modal.querySelector('h2').textContent = 'Editar Item';
            modal.querySelector('button[type="submit"]').textContent = 'Salvar Alterações';
            showModal(modal);
        }
    }
    
    // Deleta item
    function handleDeleteItem(id, type) {
        const data = currentMonthData;
        let list;
        let itemIndex = -1;
        let item = null;

        if (type === 'daily') list = data.dailyExpenses;
        else if (type === 'projected') list = data.projectedExpenses;
        else if (type === 'income') list = data.income;

        if (list) itemIndex = list.findIndex(i => i.id === id);

        if (itemIndex > -1) {
            item = list.splice(itemIndex, 1)[0]; 
        }
        
        if (item && item.category === 'investimentos') {
            updateInvestedAllTime(-item.amount);
        }
        saveDatabase();
        updateUI();
    }

    // --- HANDLERS DE FORMULÁRIO (TIPO/MÊS) ---

    function handleExpenseTypeChange(e) {
        if (e.target.value === 'recorrente') {
            expenseTotalAmountGroup.style.display = 'none';
            expenseAmountInput.required = false;
            expenseInstallmentsGroup.style.display = 'block';
            generateInstallmentInputs(parseInt(expenseInstallmentsInput.value, 10), expenseInstallmentValuesContainer, 'expense');
        } else {
            expenseTotalAmountGroup.style.display = 'block';
            expenseAmountInput.required = true;
            expenseInstallmentsGroup.style.display = 'none';
            expenseInstallmentValuesContainer.innerHTML = '';
        }
    }
    
    function handleInvestmentTypeChange(e) {
        if (e.target.value === 'recorrente') {
            investmentTotalAmountGroup.style.display = 'none';
            investmentAmountInput.required = false;
            investmentInstallmentsGroup.style.display = 'block';
            generateInstallmentInputs(parseInt(investmentInstallmentsInput.value, 10), investmentInstallmentValuesContainer, 'investment');
        } else {
            investmentTotalAmountGroup.style.display = 'block';
            investmentAmountInput.required = true;
            investmentInstallmentsGroup.style.display = 'none';
            investmentInstallmentValuesContainer.innerHTML = '';
        }
    }
    
    async function handleMonthChange(e) {
        currentMonthKey = e.target.value;
        await loadDatabase(); // Carrega os dados do novo mês
        updateUI(); 
    }

    // --- INICIALIZAÇÃO ---
    function init() {
        // Event Listeners de Autenticação
        loginForm.addEventListener('submit', handleLogin);
        registerForm.addEventListener('submit', handleRegister);
        nameLoginForm.addEventListener('submit', handleNameLogin);
        logoutBtn.addEventListener('click', handleLogout);

        // Listeners para alternar forms
        showRegisterBtn.addEventListener('click', () => {
            loginForm.classList.add('hidden');
            nameLoginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        });
        showPublicLoginBtn.addEventListener('click', () => {
            loginForm.classList.add('hidden');
            registerForm.classList.add('hidden');
            nameLoginForm.classList.remove('hidden');
            // Tenta pegar o último nome público usado
            const lastPublicName = localStorage.getItem('lastPublicName');
            if(lastPublicName) userNameInput.value = lastPublicName;
        });
        showLoginFromRegisterBtn.addEventListener('click', () => {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            nameLoginForm.classList.add('hidden');
        });
        showPrivateLoginBtn.addEventListener('click', () => {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            nameLoginForm.classList.add('hidden');
        });


        // Event Listeners do App
        addIncomeBtn.addEventListener('click', () => showModal(incomeModal));
        addExpenseBtn.addEventListener('click', () => {
            document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
            showModal(expenseModal);
        });
        addInvestmentBtn.addEventListener('click', () => showModal(investmentModal));
        
        closeIncomeModal.addEventListener('click', () => hideModal(incomeModal));
        closeExpenseModal.addEventListener('click', () => hideModal(expenseModal));
        closeInvestmentModal.addEventListener('click', () => hideModal(investmentModal));
        
        window.addEventListener('click', (e) => {
            if (e.target === incomeModal) hideModal(incomeModal);
            if (e.target === expenseModal) hideModal(expenseModal);
            if (e.target === investmentModal) hideModal(investmentModal);
        });
        
        incomeForm.addEventListener('submit', handleIncomeSubmit);
        expenseForm.addEventListener('submit', handleExpenseSubmit);
        investmentForm.addEventListener('submit', handleInvestmentSubmit);
        
        monthSelector.addEventListener('change', handleMonthChange);
        
        expenseTypeRadios.forEach(radio => radio.addEventListener('change', handleExpenseTypeChange));
        investmentTypeRadios.forEach(radio => radio.addEventListener('change', handleInvestmentTypeChange));

        expenseInstallmentsInput.addEventListener('input', (e) => {
            let count = parseInt(e.target.value, 10);
            if (isNaN(count) || count < 1) count = 0;
            if (count > 60) { count = 60; e.target.value = 60; }
            if (count > 0) {
                generateInstallmentInputs(count, expenseInstallmentValuesContainer, 'expense');
            } else {
                expenseInstallmentValuesContainer.innerHTML = '';
            }
        });
        
        investmentInstallmentsInput.addEventListener('input', (e) => {
            let count = parseInt(e.target.value, 10);
            if (isNaN(count) || count < 1) count = 0;
            if (count > 60) { count = 60; e.target.value = 60; }
            if (count > 0) {
                generateInstallmentInputs(count, investmentInstallmentValuesContainer, 'investment');
            } else {
                investmentInstallmentValuesContainer.innerHTML = '';
            }
        });

        // Inicia o observador de autenticação
        initAuth();
    }

    init(); // Inicia a aplicação
});