import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth, db } from '../firebase'; // Importa a conexão central
import firebase from 'firebase/compat/app';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import html2canvas from 'html2canvas';

// Registrar componentes do Chart.js
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const APP_ID = "rodaodef"; 
const getCol = (n) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection(n);
const getConfigDoc = () => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('config').doc('main');

// --- FUNÇÕES UTILITÁRIAS ---
const formatMoney = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const calculateSmartPrice = (cost, cmvPercent) => {
    if (!cost || cost <= 0) return 0;
    const cmv = cmvPercent || 35;
    const targetPrice = cost / (cmv / 100); 
    return Math.ceil(targetPrice) - 0.01;
};

// --- COMPONENTES AUXILIARES (Lógica extraída do seu HTML) ---

// (Aqui você deve manter as funções que já possuía: sendWhatsAppNotification, GlobalModal, LoginView)
// Vou focar na estrutura principal do Admin para o Vite:

export default function Admin() {
    const [user, setUser] = useState(null); 
    const [view, setView] = useState('dashboard'); 
    const [products, setProducts] = useState([]); 
    const [categories, setCategories] = useState([]); 
    const [ingredients, setIngredients] = useState([]); 
    const [sauceIngredients, setSauceIngredients] = useState([]);
    const [sauces, setSauces] = useState([]);
    const [settings, setSettings] = useState({}); 
    const [loading, setLoading] = useState(true); 
    const [sidebarOpen, setSidebarOpen] = useState(false); 
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });
    const [onlineCount, setOnlineCount] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Efeito de autenticação
    useEffect(() => { 
        const unsubAuth = auth.onAuthStateChanged(u => { 
            setUser(u); 
            if(u) fetchData(); 
            else setLoading(false); 
        }); 
        return () => unsubAuth();
    }, []);

    const fetchData = () => {
        const unsubs = [];
        unsubs.push(getCol('products').onSnapshot(s => setProducts(s.docs.map(d=>({id:d.id, ...d.data()})))));
        unsubs.push(getCol('categories').orderBy('order').onSnapshot(s => setCategories(s.docs.map(d=>({id:d.id, ...d.data()})))));
        unsubs.push(getCol('ingredients').onSnapshot(s => setIngredients(s.docs.map(d=>({id:d.id, ...d.data()})))));
        unsubs.push(getCol('sauce_ingredients').onSnapshot(s => setSauceIngredients(s.docs.map(d=>({id:d.id, ...d.data()})))));
        unsubs.push(getCol('sauces').onSnapshot(s => setSauces(s.docs.map(d=>({id:d.id, ...d.data()})))));
        unsubs.push(getConfigDoc().onSnapshot(d => { if(d.exists) setSettings(d.data()); setLoading(false); }));
        return () => unsubs.forEach(u => u());
    };

    const handleLogin = async (email, password) => { 
        setLoading(true); 
        try { 
            await auth.signInWithEmailAndPassword(email, password); 
        } catch (error) { 
            alert("Erro: Login inválido.");
            setLoading(false); 
        } 
    };

    if (loading && !user) return <div className="min-h-screen flex items-center justify-center text-gray-400"><i className="fa-solid fa-spinner fa-spin text-3xl"></i></div>;
    
    if (!user) return <LoginView onLogin={handleLogin} loading={loading} />;

    const themeStyle = { backgroundColor: settings.themeColor || '#dc2626' };

    return (
        <div className="min-h-screen flex bg-gray-100">
            {/* Sidebar e Navegação */}
            <aside className={`fixed md:relative w-64 h-screen z-50 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`} style={themeStyle}>
                <div className="p-6 text-white font-bold text-2xl flex items-center gap-2">
                    <i className="fa-solid fa-pizza-slice"></i> {settings.appName || 'Admin'}
                </div>
                <nav className="p-4 space-y-2">
                    <button onClick={() => setView('dashboard')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 ${view === 'dashboard' ? 'bg-white text-red-600 shadow' : 'text-white hover:bg-white/10'}`}>
                        <i className="fa-solid fa-chart-pie w-6"></i> Resumo
                    </button>
                    <button onClick={() => setView('orders')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 ${view === 'orders' ? 'bg-white text-red-600 shadow' : 'text-white hover:bg-white/10'}`}>
                        <i className="fa-solid fa-list-check w-6"></i> Pedidos
                    </button>
                    {/* ... Adicione os outros botões de menu aqui seguindo o mesmo padrão ... */}
                </nav>
                
                <div className="absolute bottom-0 w-full p-4 border-t border-white/10">
                    <button onClick={() => auth.signOut()} className="w-full p-3 text-white flex items-center gap-3 hover:bg-white/10 rounded-lg">
                        <i className="fa-solid fa-right-from-bracket w-6"></i> Sair
                    </button>
                </div>
            </aside>

            {/* Conteúdo Principal */}
            <main className="flex-1 h-screen overflow-y-auto p-4 md:p-8">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800 uppercase">
                        {view}
                    </h1>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden text-2xl"><i className="fa-solid fa-bars"></i></button>
                </header>

                <div className="max-w-6xl mx-auto">
                    {view === 'dashboard' && <AdminDashboard theme={themeStyle} />}
                    {view === 'orders' && <AdminOrders settings={settings} />}
                    {view === 'products' && <AdminProducts products={products} categories={categories} settings={settings} theme={themeStyle} />}
                    {/* ... Renderize as outras views aqui ... */}
                </div>
            </main>
        </div>
    );
}

function AdminDashboard({ theme }) { 
    const [stats, setStats] = useState({ todaySales: 0, todayOrders: 0, avgTicket: 0, pending: 0 }); 
    const [topProducts, setTopProducts] = useState([]);
    const [abandonedCarts, setAbandonedCarts] = useState([]);
    const [dailyVisits, setDailyVisits] = useState(0);
    const chartRef = React.useRef(null);
    const chartInstance = React.useRef(null);

    useEffect(() => { 
        const startOfDay = new Date(); 
        startOfDay.setHours(0,0,0,0); 
        
        // Formata a data de hoje no fuso local (YYYY-MM-DD) para as visitas
        const todayStr = `${startOfDay.getFullYear()}-${String(startOfDay.getMonth() + 1).padStart(2, '0')}-${String(startOfDay.getDate()).padStart(2, '0')}`;

        // 1. Puxar Vendas de Hoje e Produtos Mais Vendidos
        // Usa o startOfDay (com a hora zerada) para puxar os pedidos do Firebase
        const uOrders = getCol('orders').where('createdAt', '>=', startOfDay.toISOString()).onSnapshot(s => {
            let total = 0, count = 0, pending = 0; 
            let productCount = {};

            s.docs.forEach(d => { 
                const data = d.data(); 
                total += (data.totals?.total || 0); 
                count++; 
                if(data.status === 'pendente' || data.status === 'enviado') pending++; 

                // Contabiliza os produtos para o ranking
                if (data.items) {
                    data.items.forEach(item => {
                        if (!productCount[item.name]) productCount[item.name] = { name: item.name, qty: 0, total: 0 };
                        productCount[item.name].qty += item.quantity;
                        productCount[item.name].total += (item.price * item.quantity);
                    });
                }
            }); 
            
            setStats({ todaySales: total, todayOrders: count, avgTicket: count > 0 ? total / count : 0, pending }); 
            setTopProducts(Object.values(productCount).sort((a, b) => b.qty - a.qty).slice(0, 5)); // Top 5
        }); 

        // 2. Puxar Carrinhos Abandonados (Atualizados nos últimos 60 minutos)
        const hourAgo = new Date(Date.now() - 60 * 60000).toISOString();
        const uCarts = getCol('active_carts').where('updatedAt', '>=', hourAgo).onSnapshot(s => {
            setAbandonedCarts(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // 3. Puxar Visitas de Hoje
        const uVisits = getCol('daily_stats').doc(todayStr).onSnapshot(doc => {
            if (doc.exists) setDailyVisits(doc.data().visits || 0);
        });

        // 4. Puxar histórico de visitas para o Gráfico (Últimos 7 dias)
        const d7 = new Date(Date.now() - 7 * 24 * 60 * 60000);
        const sevenDaysAgo = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, '0')}-${String(d7.getDate()).padStart(2, '0')}`;
        getCol('daily_stats').where('date', '>=', sevenDaysAgo).get().then(snap => {
            const dataMap = {};
            snap.forEach(d => { dataMap[d.id] = d.data().visits; });
            
            // Monta os últimos 7 dias sequenciais
            const labels = [];
            const dataPoints = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(Date.now() - i * 24 * 60 * 60000);
                const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                labels.push(`${d.getDate()}/${d.getMonth()+1}`);
                dataPoints.push(dataMap[dStr] || 0);
            }

            // Renderiza o Gráfico
            if (chartRef.current) {
                if (chartInstance.current) chartInstance.current.destroy();
                chartInstance.current = new Chart(chartRef.current, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Visitas Únicas',
                            data: dataPoints,
                            borderColor: theme.backgroundColor,
                            backgroundColor: theme.backgroundColor + '33', // com transparência
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
            }
        });

        return () => { uOrders(); uCarts(); uVisits(); if (chartInstance.current) chartInstance.current.destroy(); }; 
    }, [theme]); 

    return ( 
        <div className="space-y-6 animate-fade-in"> 
            
            {/* CARDS SUPERIORES */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"> 
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xl"><i className="fa-solid fa-money-bill-trend-up"></i></div>
                    <div><div className="text-gray-500 text-xs font-bold uppercase">Vendas Hoje</div><div className="text-2xl font-black text-gray-800">{formatMoney(stats.todaySales)}</div></div>
                </div> 
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl"><i className="fa-solid fa-bag-shopping"></i></div>
                    <div><div className="text-gray-500 text-xs font-bold uppercase">Pedidos</div><div className="text-2xl font-black text-gray-800">{stats.todayOrders}</div></div>
                </div> 
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xl"><i className="fa-solid fa-users"></i></div>
                    <div><div className="text-gray-500 text-xs font-bold uppercase">Visitas Hoje</div><div className="text-2xl font-black text-gray-800">{dailyVisits}</div></div>
                </div> 
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl"><i className="fa-solid fa-cart-arrow-down"></i></div>
                    <div><div className="text-gray-500 text-xs font-bold uppercase">Carrinhos Ativos</div><div className="text-2xl font-black text-gray-800">{abandonedCarts.length}</div></div>
                </div> 
            </div> 

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* GRÁFICO DE TRÁFEGO */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i className="fa-solid fa-chart-line text-gray-400"></i> Tráfego nos Últimos 7 Dias</h3>
                    <div className="h-64 relative w-full"><canvas ref={chartRef}></canvas></div>
                </div>

                {/* RANKING DE PRODUTOS */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i className="fa-solid fa-trophy text-yellow-500"></i> Mais Vendidos (Hoje)</h3>
                    {topProducts.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">Nenhuma venda registrada hoje ainda.</p> : (
                        <div className="space-y-4">
                            {topProducts.map((p, idx) => (
                                <div key={idx} className="flex justify-between items-center border-b pb-2 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <span className="font-black text-gray-400 text-lg w-4">{idx + 1}º</span>
                                        <div>
                                            <div className="font-bold text-gray-700 text-sm">{p.name}</div>
                                            <div className="text-xs text-gray-500">{p.qty} unidades vendidas</div>
                                        </div>
                                    </div>
                                    <div className="font-bold text-green-600 text-sm">{formatMoney(p.total)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* RADAR DE CARRINHOS (Estilo iFood) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><i className="fa-solid fa-radar text-red-500"></i> Radar de Carrinhos (Última hora)</h3>
                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">R$ {formatMoney(abandonedCarts.reduce((a,b)=>a+b.total,0))} parados</span>
                </div>
                {abandonedCarts.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-xl border border-dashed"><i className="fa-solid fa-ghost text-2xl mb-2 block text-gray-300"></i>Nenhum carrinho ativo ou abandonado no momento.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {abandonedCarts.map((c, i) => (
                            <div key={i} className="border p-4 rounded-xl bg-orange-50 border-orange-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-orange-200 text-orange-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                    Atualizado às {new Date(c.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                                <div className="font-bold text-gray-800 mb-2 mt-1">{c.itemCount} {c.itemCount === 1 ? 'item' : 'itens'}</div>
                                <div className="text-xs text-gray-600 space-y-1 mb-3">
                                    {c.items.map((item, idx) => <div key={idx} className="truncate"><i className="fa-solid fa-caret-right text-orange-400 mr-1"></i> {item}</div>)}
                                </div>
                                <div className="border-t border-orange-200 pt-2 flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Potencial</span>
                                    <span className="font-black text-orange-700">{formatMoney(c.total)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
        </div> 
    ); 
}

function AdminOrders({ showConfirm, settings }) { 
    const [allOrders, setAllOrders] = useState([]);
    const [filter, setFilter] = useState('today');

    const silentPrint = (order, currentSettings) => {
        let iframe = document.getElementById('silent-print-frame');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'silent-print-frame';
            iframe.style.width = '58mm'; 
            iframe.style.position = 'absolute';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
        }
        
        const itemsHtml = order.items?.map(i => `<div class="item"><span>${i.quantity}x ${i.name}</span><span>${formatMoney(i.price * i.quantity)}</span></div>${i.obs ? `<div class="obs">Obs: ${i.obs}</div>` : ''}`).join('') || '';
        const doc = iframe.contentWindow.document;
        
        doc.open();
        doc.write(`
            <html><head><title>Cupom #${order.id.slice(-4)}</title>
            <style>
                @page { margin: 0; size: 58mm auto; }
                body { font-family: 'Arial', sans-serif; width: 48mm; margin: 0 auto; padding: 0; font-size: 13px; color: #000000 !important; font-weight: 900 !important; line-height: 1.3; -webkit-font-smoothing: none; text-rendering: crispEdges; }
                .title { font-size: 24px; font-weight: 900; text-transform: uppercase; text-align: center; }
                .subtitle { font-size: 13px; text-align: center; }
                .divider { border-bottom: 2px dashed #000; margin: 10px 0; }
                .info { font-size: 13px; line-height: 1.5; }
                .pagamento-destaque { font-size: 18px; font-weight: 900; text-transform: uppercase; border: 2px dashed #000; padding: 10px 5px; text-align: center; border-radius: 5px; line-height: 1.2; margin: 15px 0; }
                .items { width: 100%; }
                .item { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; }
                .obs { font-size: 12px; font-style: italic; margin-bottom: 8px; }
                .totals { border-top: 2px dashed #000; margin-top: 5px; padding-top: 10px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px; }
                .total-final { font-size: 20px; font-weight: 900; margin-top: 8px; border-top: 2px solid #000; padding-top: 8px; }
                .espaco-corte { height: 25px; } 
            </style>
            </head><body>
                <div class="espaco-corte"></div><br/>
                <div class="title">${currentSettings?.appName || 'X-RODÃO'}</div><br/><br/>
                <div class="subtitle">Pedido #${order.id.slice(-4)}<br/>${new Date(order.createdAt).toLocaleString('pt-BR')}</div>
                <div class="divider"></div>
                <div class="info"><b>Cliente:</b> ${order.customer?.name || 'Não inf.'}<br/><b>Tel:</b> ${order.customer?.phone || 'Não inf.'}<br/><b>End:</b> ${order.customer?.address || ''}, ${order.customer?.number || ''}<br/><b>Bairro:</b> ${order.customer?.bairro || ''}</div>
                <div class="pagamento-destaque">PAGT: ${order.payment?.method} ${order.payment?.change ? '<br/>(Troco para: '+order.payment.change+')' : ''}</div><br/><br/>
                <div class="items">${itemsHtml}</div><br/>
                <div class="totals"><br/><div class="row"><span>Subtotal:</span><span>${formatMoney(order.totals?.sub || 0)}</span></div><div class="row"><span>Entrega:</span><span>${formatMoney(order.totals?.del || 0)}</span></div>${order.totals?.discount ? `<div class="row"><span>Desconto:</span><span>-${formatMoney(order.totals?.discount)}</span></div>` : ''}<div class="row total-final"><span>TOTAL:</span><span>${formatMoney(order.totals?.total || 0)}</span></div></div>
                <br/><br/><br/>.<div class="espaco-corte"></div>
            </body></html>
        `);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 500);
    };

    useEffect(() => { 
        const u = getCol('orders').orderBy('createdAt', 'desc').limit(500).onSnapshot(s => {
            s.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const order = change.doc.data();
                    const isNew = (new Date() - new Date(order.createdAt)) < 60000;
                    if (isNew && order.status === 'pendente') {
                        silentPrint({ id: change.doc.id, ...order }, settings);
                    }
                }
            });
            setAllOrders(s.docs.map(d => ({ id: d.id, ...d.data() })));
        }); 
        return () => u(); 
    }, [settings]);

    const filteredOrders = useMemo(() => {
        const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (filter === 'today') return allOrders.filter(o => new Date(o.createdAt) >= today);
        return allOrders;
    }, [filter, allOrders]);
    
    const nextStatus = async (order) => {
        const statusFlow = { 'pendente': 'confirmado', 'confirmado': 'enviado', 'enviado': 'entregue' };
        const newStatus = statusFlow[order.status];
        if(newStatus) {
            await getCol('orders').doc(order.id).update({ status: newStatus });
            if (['confirmado', 'enviado', 'entregue'].includes(newStatus) && order.customer?.phone) {
                sendWhatsAppNotification(order.customer.phone, newStatus, order.customer.name, settings);
            }
        }
    };

    const del = (id) => showConfirm("Excluir", "Excluir pedido?", async () => await getCol('orders').doc(id).delete()); 

    return (
        <div className="space-y-4">
            <div className="flex gap-2 bg-gray-50 p-2 rounded-lg border">
                {['today', 'all'].map(k => <button key={k} onClick={()=>setFilter(k)} className={`px-4 py-1 rounded text-sm font-bold ${filter===k?'bg-gray-800 text-white':'bg-white border'}`}>{k==='today'?'Hoje':'Todos'}</button>)}
            </div>
            {filteredOrders.map(x => (
                <div key={x.id} className={`border p-3 rounded-lg bg-white shadow-sm border-l-4 transition hover:shadow-md ${x.status==='pendente'?'border-l-red-500':x.status==='confirmado'?'border-l-blue-500':x.status==='entregue'?'border-l-green-500':'border-l-yellow-500'}`}>
                    <div className="flex justify-between items-start">
                        <div><div className="font-bold text-gray-800 text-lg">{x.customer?.name} <span className="text-xs font-normal text-gray-400">#{x.id.slice(-4)}</span></div><div className="text-xs text-gray-500">{new Date(x.createdAt).toLocaleString()}</div></div>
                        <div className="text-right"><span className="text-green-600 font-bold text-xl block">{formatMoney(x.totals?.total || 0)}</span></div>
                    </div>
                    <div className="mt-2 bg-gray-50 p-2 rounded text-sm text-gray-700">{x.items?.map((i,idx) => (<div key={idx} className="flex justify-between border-b last:border-0 py-1"><span>{i.quantity}x {i.name}</span></div>))}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs items-center justify-between">
                        <span className={`uppercase font-bold px-2 py-1 rounded ${x.status==='pendente'?'bg-red-100 text-red-700':x.status==='entregue'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{x.status}</span>
                        <div className="flex gap-2">
                            {x.status !== 'entregue' && <button onClick={()=>nextStatus(x)} className="bg-blue-600 text-white px-3 py-1 rounded font-bold hover:bg-blue-700">Avançar <i className="fa-brands fa-whatsapp ml-1"></i></button>}
                            <button onClick={()=>silentPrint(x, settings)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded font-bold hover:bg-gray-300" title="Reimprimir Cupom"><i className="fa-solid fa-print"></i></button>
                            <button onClick={()=>del(x.id)} className="text-red-500 bg-red-50 px-3 py-1 rounded font-bold hover:bg-red-100"><i className="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    ); 
}

function AdminProducts({products, categories, ingredients, settings, theme, showAlert, showConfirm, showLoading, closeModal}) { 
    const [edit, setEdit] = useState(false); 
    const [data, setData] = useState({name:"", price:"", ifoodPrice:"", category:"", imageUrl:"", description:"", size: "", isCombo: false, recipe: [], comboItems: []});
    const [newIng, setNewIng] = useState({ id: "", qty: "" });
    const [newComboItem, setNewComboItem] = useState({ id: "", qty: "1" });
    const [prodSearch, setProdSearch] = useState(""); 
    const [ingSearch, setIngSearch] = useState("");
    const [comboSearch, setComboSearch] = useState("");

    const addIngToRecipe = () => { if(!newIng.id || !newIng.qty) return; const ing = ingredients.find(i => i.id === newIng.id); const currentRecipe = [...(data.recipe || []), { id: newIng.id, name: ing.name, unit: ing.unit, cost: ing.cost, qty: parseFloat(newIng.qty) }]; setData({ ...data, recipe: currentRecipe }); setNewIng({ id: "", qty: "" }); setIngSearch(""); };
    const removeIngFromRecipe = (idx) => { const newRecipe = [...data.recipe]; newRecipe.splice(idx, 1); setData({ ...data, recipe: newRecipe }); };
    const updateIngQty = (idx, newQty) => { const newRecipe = [...data.recipe]; newRecipe[idx].qty = parseFloat(newQty) || 0; setData({ ...data, recipe: newRecipe }); };
    // --- FUNÇÕES DE CUSTO ---
    const getProductCost = (prod) => {
        if (!prod) return 0;
        if (prod.isCombo) {
            return (prod.comboItems || []).reduce((acc, item) => {
                const p = products.find(x => x.id === item.id);
                const pCost = p ? (p.recipe || []).reduce((a, i) => {
                    const ing = ingredients.find(ingr => ingr.id === i.id);
                    return a + ((ing ? ing.cost : i.cost) * i.qty);
                }, 0) : 0;
                return acc + (pCost * item.qty);
            }, 0);
        }
        return (prod.recipe || []).reduce((acc, item) => {
            const ing = ingredients.find(i => i.id === item.id);
            return acc + ((ing ? ing.cost : item.cost) * item.qty);
        }, 0);
    };

    const getMetrics = (prod) => { 
        const totalCost = getProductCost(prod);
        let sumPrices = 0;
        
        if (prod.isCombo) {
            sumPrices = (prod.comboItems || []).reduce((acc, item) => {
                const p = products.find(x => x.id === item.id);
                return acc + ((p ? p.price : item.price) * item.qty);
            }, 0);
        }
        
        const cmv = settings.targetCMV || 35; 
        const suggested = calculateSmartPrice(totalCost, cmv); 
        const rawIfood = suggested > 0 ? suggested / 0.73 : 0; 
        const ifood = rawIfood > 0 ? Math.ceil(rawIfood) - 0.01 : 0; 
        return { totalCost, suggested, ifood, sumPrices }; 
    };    
    const metrics = getMetrics(data);

    // --- MANEJO DO COMBO ---
    const addProductToCombo = () => {
        if(!newComboItem.id || !newComboItem.qty) return;
        const prod = products.find(p => p.id === newComboItem.id);
        const currentItems = [...(data.comboItems || []), { id: newComboItem.id, name: prod.name, price: prod.price, qty: parseFloat(newComboItem.qty) }];
        setData({ ...data, comboItems: currentItems });
        setNewComboItem({ id: "", qty: "1" });
        setComboSearch("");
    };
    const removeComboItem = (idx) => { const newItems = [...data.comboItems]; newItems.splice(idx, 1); setData({ ...data, comboItems: newItems }); };
    const updateComboItemQty = (idx, newQty) => { const newItems = [...data.comboItems]; newItems[idx].qty = parseFloat(newQty) || 0; setData({ ...data, comboItems: newItems }); };
    // --- SALVAR PRODUTO ---
    const save = async (e) => { 
        e.preventDefault(); 
        const p = {
            ...data, 
            price:parseFloat(data.price), 
            ifoodPrice: data.ifoodPrice ? parseFloat(data.ifoodPrice) : null,
            isCombo: data.isCombo || false,
            comboItems: data.isCombo ? (data.comboItems || []) : [],
            recipe: !data.isCombo ? (data.recipe || []) : []
        }; 
        if(data.id) await getCol('products').doc(data.id).update(p); 
        else await getCol('products').add(p); 
        setEdit(false); 
        setData({name:"", price:"", ifoodPrice:"", category:"", imageUrl:"", description:"", size: "", isCombo: false, recipe: [], comboItems: []}); 
        showAlert("Sucesso", "Salvo!", "success"); 
    }; 
    const del = (id) => showConfirm("Excluir?", "Apagar produto?", async () => await getCol('products').doc(id).delete());
	
	// --- Lógica de Atualização em Massa de Preços ---
    const bulkUpdatePrices = (type) => {
        let title = type === 'suggested' ? 'Usar Sugerido' : type === 'suggested20' ? 'Sugerido + 20%' : type === 'ifood' ? 'Usar iFood' : 'Preencher iFood';
        let msg = type === 'fill_ifood' 
            ? 'Isso vai calcular e preencher o "Preço iFood" dos produtos com receita (EXCETO Bebidas, Promos e Combos). O preço de venda não será alterado. Continuar?' 
            : `Isso vai recalcular e alterar o PREÇO DE VENDA de TODOS os produtos que possuem receita para o valor "${title}". Deseja continuar?`;

        showConfirm(
            type === 'fill_ifood' ? "Preencher Preço iFood em Todos?" : "Atualizar TODOS os preços?", 
            msg, 
            async () => {
                showLoading("Atualizando produtos...", "Isso pode levar alguns segundos.");
                try {
                    const batch = db.batch();
                    let count = 0;
                    
                    products.forEach(p => {
                        // Só atualiza produtos que tenham receita montada
                        if (p.recipe && p.recipe.length > 0) {
                            const m = getMetrics(p);
                            
                            if (type === 'fill_ifood') {
                                // Regra: Ignorar Bebidas, Promos e Combos
                                // Regra: Ignorar Bebidas e Combos (Promos permitidas)
								const catLower = (p.category || "").toLowerCase();
								const isExcluded = catLower.includes('bebida') || catLower.includes('combo');
                                
                                if (!isExcluded) {
                                    const newIfoodPrice = parseFloat(m.ifood.toFixed(2));
                                    if (newIfoodPrice > 0) {
                                        batch.update(getCol('products').doc(p.id), { ifoodPrice: newIfoodPrice });
                                        count++;
                                    }
                                }
                            } else {
                                // Atualiza o preço normal de venda
                                let newPrice = 0;
                                if (type === 'suggested') newPrice = m.suggested;
                                else if (type === 'suggested20') {
                                    const val = Math.ceil(m.suggested * 1.20) - 0.01;
                                    newPrice = val > 0 ? val : 0;
                                } else if (type === 'ifood') newPrice = parseFloat(m.ifood.toFixed(2));
                                
                                if (newPrice > 0) {
                                    batch.update(getCol('products').doc(p.id), { price: newPrice });
                                    count++;
                                }
                            }
                        }
                    });
                    
                    if (count > 0) {
                        await batch.commit();
                        closeModal();
                        setTimeout(() => showAlert("Sucesso", `${count} produtos atualizados com sucesso!`, "success"), 300);
                    } else {
                        closeModal();
                        setTimeout(() => showAlert("Aviso", "Nenhum produto válido para atualizar.", "info"), 300);
                    }
                } catch (error) {
                    console.error("Erro ao atualizar preços em lote:", error);
                    closeModal();
                    setTimeout(() => showAlert("Erro", "Falha ao atualizar preços. Verifique a conexão.", "error"), 300);
                }
            }
        );
    };
	
    // --- Lógica de Geração de Cardápio em Imagens ---
    const startMenuImageGeneration = () => {
        showConfirm(
            "Gerar Cardápio (Imagens)", 
            "Isso vai gerar e baixar uma imagem de cardápio para CADA categoria que tiver produtos cadastrados. O navegador pode pedir permissão para baixar múltiplos arquivos de uma vez. Deseja continuar?", 
            generateMenuImages
        );
    };

    const generateMenuImages = async () => {
        showLoading("Montando o cardápio...", "Isso pode levar alguns segundos dependendo da quantidade de produtos.");
        
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        document.body.appendChild(container);

        try {
            let count = 0;
            for (const cat of categories) {
                const catProds = products.filter(p => p.category === cat.name);
                if (catProds.length === 0) continue;

                const div = document.createElement('div');
                div.style.width = '800px';
                div.style.backgroundColor = settings.bgColor || '#ffffff';
                div.style.padding = '40px';
                div.style.fontFamily = "'Poppins', sans-serif";
                div.style.color = '#333';
                
                let html = `
                    <div style="text-align: center; margin-bottom: 30px;">
                        ${settings.logoUrl ? `<img src="${settings.logoUrl}" style="max-height: 100px; margin-bottom: 15px; border-radius: ${settings.logoStyle==='circle'?'50%':'10px'};" crossorigin="anonymous"/>` : ''}
                        <h1 style="color: ${settings.themeColor || '#dc2626'}; font-size: 38px; margin: 0; font-weight: 900; text-transform: uppercase;">${settings.appName || 'Cardápio'}</h1>
                        <div style="display: inline-block; background-color: ${settings.themeColor || '#dc2626'}; color: white; padding: 5px 20px; border-radius: 20px; font-size: 24px; font-weight: bold; margin-top: 15px;">
                            ${cat.name}
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                `;

                catProds.forEach(p => {
    // Cria uma tag visual para o tamanho, se ele existir
    const sizeBadge = p.size ? `<span style="background-color: #f3f4f6; color: #374151; font-size: 16px; padding: 4px 10px; border-radius: 8px; font-weight: bold; margin-left: 12px; border: 1px solid #d1d5db;">${p.size}</span>` : '';
    
    html += `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px dashed #e5e7eb; padding-bottom: 20px;">
            <div style="flex: 1; padding-right: 20px;">
                <h3 style="margin: 0; font-size: 26px; color: #1f2937; font-weight: bold; display: flex; align-items: center;">${p.name} ${sizeBadge}</h3>
                <p style="margin: 8px 0 0 0; font-size: 18px; color: #6b7280; line-height: 1.4;">${p.description || ''}</p>
            </div>
            <div style="font-size: 30px; font-weight: 900; color: ${settings.themeColor || '#dc2626'}; white-space: nowrap;">
                ${formatMoney(p.price)}
            </div>
        </div>
    `;
});

                html += `
                    </div>
                    <div style="text-align: center; margin-top: 40px; font-size: 18px; color: #9ca3af; font-weight: 500;">
                        Faça seu pedido pelo nosso WhatsApp!
                    </div>
                `;

                div.innerHTML = html;
                container.appendChild(div);

                await new Promise(r => setTimeout(r, 500)); // Pequeno respiro pro navegador renderizar as imagens web

                const canvas = await html2canvas(div, { 
                    scale: 2, // Boa resolução para celulares
                    useCORS: true,
                    backgroundColor: settings.bgColor || '#ffffff'
                });

                const link = document.createElement('a');
                link.download = `Cardapio_${(settings.appName || 'Fritzza').replace(/\s+/g, '')}_${cat.name.replace(/\s+/g, '')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                
                container.innerHTML = ''; 
                count++;
                
                await new Promise(r => setTimeout(r, 600)); // Respiro entre um download e outro
            }
            
            closeModal();
            setTimeout(() => {
                showAlert("Sucesso!", `Foram geradas ${count} imagens do cardápio.`, "success");
            }, 300);
        } catch (error) {
            console.error("Erro ao gerar imagens:", error);
            closeModal();
            showAlert("Erro", "Falha ao gerar o cardápio em imagens.", "error");
        } finally {
            document.body.removeChild(container);
        }
    };

    // Filtros de busca
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.category.toLowerCase().includes(prodSearch.toLowerCase()));
    const filteredIngs = ingredients.filter(i => i.name.toLowerCase().includes(ingSearch.toLowerCase()));

    return ( 
        <div> 
            <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={()=>{setData({name:"", price:"", ifoodPrice: "", category:categories[0]?.name||"", size: "", recipe: []}); setEdit(true)}} className="text-white px-4 py-2 rounded font-bold shadow whitespace-nowrap" style={theme}>+ Produto</button>                <button onClick={startMenuImageGeneration} className="bg-gray-800 text-white px-4 py-2 rounded font-bold shadow hover:bg-gray-700 transition flex items-center gap-2">
                    <i className="fa-solid fa-images"></i> Gerar Imagens (Cardápio)
                </button>
                {!edit && <input placeholder="🔍 Buscar produto pelo nome ou categoria..." className="border p-2 rounded flex-1 shadow-sm min-w-[200px]" value={prodSearch} onChange={e=>setProdSearch(e.target.value)} />}
            </div>

            {edit && <form onSubmit={save} className="bg-gray-50 p-4 rounded-lg mb-4 space-y-3 border shadow-sm animate-fade-in"> 
    
    {/* TOGGLE TIPO DE PRODUTO */}
    <div className="flex gap-4 mb-3 border-b border-gray-200 pb-3">
        <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700 bg-white px-4 py-2 rounded-lg border shadow-sm">
            <input type="radio" checked={!data.isCombo} onChange={() => setData({...data, isCombo: false})} name="prodType" className="w-4 h-4 text-blue-600" />
            Produto Normal
        </label>
        <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200 shadow-sm">
            <input type="radio" checked={data.isCombo} onChange={() => setData({...data, isCombo: true})} name="prodType" className="w-4 h-4 text-indigo-600" />
            Combo Promocional
        </label>
    </div>

    <div className="grid grid-cols-2 gap-3">
        <input required placeholder={data.isCombo ? "Nome do Combo" : "Nome do Produto"} className="border p-2 rounded w-full" value={data.name} onChange={e=>setData({...data, name:e.target.value})} />
        <select className="border p-2 rounded w-full" value={data.category} onChange={e=>setData({...data, category:e.target.value})}>{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select>
    </div> 
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <input placeholder="URL Imagem" className="border p-2 rounded w-full" value={data.imageUrl} onChange={e=>setData({...data, imageUrl:e.target.value})} />
    <input placeholder="Tamanho (Ex: 500g, 2L)" className="border p-2 rounded w-full" value={data.size || ""} onChange={e=>setData({...data, size:e.target.value})} />
    <input type="number" step="0.01" required placeholder="Preço Cobrado (R$)" className="border p-2 rounded w-full font-bold text-green-600" value={data.price} onChange={e=>setData({...data, price:e.target.value})} title="Este é o preço que será cobrado no app" />
    <input type="number" step="0.01" placeholder="Preço iFood (R$)" className="border p-2 rounded w-full font-bold text-orange-600 bg-orange-50 border-orange-200" value={data.ifoodPrice || ""} onChange={e=>setData({...data, ifoodPrice:e.target.value})} title="Preencha para mostrar o desconto promocional no cardápio" />
</div>
                <textarea placeholder="Descrição" className="w-full border p-2 rounded h-20" value={data.description} onChange={e=>setData({...data, description:e.target.value})} /> 
                
                {!data.isCombo ? (
                    <div className="bg-white p-3 rounded border border-gray-300"> 
                        <h4 className="font-bold text-gray-700 mb-2 text-sm">Ficha Técnica (Meta CMV: {settings.targetCMV||35}%)</h4> 
                        
                        <div className="flex flex-col gap-2 mb-3 bg-gray-50 p-2 rounded border"> 
                            <input placeholder="🔍 Filtrar insumos na lista abaixo..." className="border p-1 text-sm rounded w-full" value={ingSearch} onChange={e=>setIngSearch(e.target.value)} />
                            <div className="flex gap-2">
                                <select className="border p-1 flex-1 text-sm" value={newIng.id} onChange={e=>setNewIng({...newIng, id:e.target.value})}>
                                    <option value="">+ Selecione o Insumo</option>
                                    {filteredIngs.map(i=><option key={i.id} value={i.id}>{i.name} ({formatMoney(i.cost)}/{i.unit})</option>)}
                                </select> 
                                <input type="number" step="0.001" placeholder="Qtd" className="border p-1 w-20 text-sm" value={newIng.qty} onChange={e=>setNewIng({...newIng, qty:e.target.value})} /> 
                                <button type="button" onClick={addIngToRecipe} className="bg-blue-600 text-white px-3 rounded font-bold hover:bg-blue-700">+</button> 
                            </div>
                        </div> 
                        
                        <div className="space-y-1 max-h-32 overflow-y-auto mb-2"> 
                            {(data.recipe || []).map((ing, idx) => ( <div key={idx} className="flex justify-between items-center text-xs bg-white p-1 rounded border shadow-sm"> <span className="flex-1 font-medium text-gray-700">{ing.name}</span> <div className="flex items-center gap-1"> <input type="number" step="0.001" className="border p-1 w-16 text-right rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50" value={ing.qty} onChange={(e) => updateIngQty(idx, e.target.value)} /> <span className="w-6 text-gray-500">{ing.unit}</span> <button type="button" onClick={()=>removeIngFromRecipe(idx)} className="text-red-500 font-bold ml-1 px-2 py-1 hover:bg-red-50 rounded"> <i className="fa-solid fa-xmark"></i> </button> </div> </div> ))} 
                        </div> 
                        <div className="grid grid-cols-3 gap-2 text-xs border-t pt-2 bg-gray-50 p-2 rounded"> <div>Custo:<br/><b className="text-red-600">{formatMoney(metrics.totalCost)}</b></div> <div>Sugerido:<br/><b className="text-blue-600">{formatMoney(metrics.suggested)}</b></div> <div>iFood (27%):<br/><b className="text-orange-600">{formatMoney(metrics.ifood)}</b></div> </div> 
                        <div className="mt-2 flex flex-wrap gap-2"> 
                            <button type="button" onClick={()=>setData({...data, price: metrics.suggested})} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold hover:bg-blue-200">Usar Sugerido</button> 
                            <button type="button" onClick={() => { const val = Math.ceil(metrics.suggested * 1.20) - 0.01; setData({...data, price: val > 0 ? val : 0}); }} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold hover:bg-purple-200">Sugerido + 20%</button>
                            <button type="button" onClick={()=>setData({...data, price: metrics.ifood.toFixed(2)})} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-bold hover:bg-orange-200">Usar iFood</button> 
                            <button type="button" onClick={()=>setData({...data, ifoodPrice: metrics.ifood.toFixed(2)})} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold hover:bg-red-200 shadow-sm"><i className="fa-solid fa-tag"></i> Preencher Desconto iFood</button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-indigo-50 p-3 rounded border border-indigo-200">
                        <h4 className="font-bold text-indigo-800 mb-2 text-sm"><i className="fa-solid fa-boxes-stacked"></i> Itens do Combo (Soma dos Preços Avulsos: {formatMoney(metrics.sumPrices)})</h4>
                        
                        <div className="flex flex-col gap-2 mb-3 bg-white p-2 rounded border border-indigo-100">
                            <input placeholder="🔍 Buscar produto para o combo..." className="border p-1 text-sm rounded w-full" value={comboSearch} onChange={e=>setComboSearch(e.target.value)} />
                            <div className="flex gap-2">
                                <select className="border p-1 flex-1 text-sm" value={newComboItem.id} onChange={e=>setNewComboItem({...newComboItem, id:e.target.value})}>
                                    <option value="">+ Selecione o Produto</option>
                                    {products.filter(p => !p.isCombo && p.name.toLowerCase().includes(comboSearch.toLowerCase())).map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({formatMoney(p.price)})</option>
                                    ))}
                                </select>
                                <input type="number" placeholder="Qtd" className="border p-1 w-20 text-sm" value={newComboItem.qty} onChange={e=>setNewComboItem({...newComboItem, qty:e.target.value})} />
                                <button type="button" onClick={addProductToCombo} className="bg-indigo-600 text-white px-3 rounded font-bold hover:bg-indigo-700">+</button>
                            </div>
                        </div>

                        <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
                            {(data.comboItems || []).map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 rounded border shadow-sm">
                                    <span className="flex-1 font-medium text-gray-700">{item.name} <span className="text-gray-400">({formatMoney(item.price)} un)</span></span>
                                    <div className="flex items-center gap-1">
                                        <input type="number" className="border p-1 w-16 text-right rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50" value={item.qty} onChange={(e) => updateComboItemQty(idx, e.target.value)} />
                                        <span className="w-6 text-gray-500">un</span>
                                        <button type="button" onClick={()=>removeComboItem(idx)} className="text-red-500 font-bold ml-1 px-2 py-1 hover:bg-red-50 rounded"> <i className="fa-solid fa-xmark"></i> </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-xs border-t border-indigo-200 pt-2 bg-white p-2 rounded">
                            <div>Custo Total (CMV):<br/><b className="text-red-600">{formatMoney(metrics.totalCost)}</b></div>
                            <div>Preço Sugerido:<br/><b className="text-blue-600">{formatMoney(metrics.suggested)}</b></div>
                            <div>iFood (27%):<br/><b className="text-orange-600">{formatMoney(metrics.ifood)}</b></div>
                        </div>
                        <div className="mt-2 text-xs text-indigo-700 bg-white p-2 rounded border border-indigo-100">
                            <b>Dica:</b> A soma de todos os itens avulsos dá <b>{formatMoney(metrics.sumPrices)}</b>. O desconto que você der no preço final do combo sairá da sua margem de lucro.
                        </div>
                    </div>
                )} 

                <div className="flex gap-2"><button type="submit" className="flex-1 text-white py-2 rounded font-bold shadow" style={theme}>Salvar</button><button type="button" onClick={()=>setEdit(false)} className="flex-1 border py-2 rounded text-gray-600 bg-white hover:bg-gray-50 font-bold">Cancelar</button></div>
            </form>} 

            {!edit && (
                <>
                    <div className="bg-gray-50 p-3 rounded-lg border shadow-sm mb-4 flex flex-wrap items-center gap-3 animate-fade-in">
                        <span className="text-sm font-bold text-gray-700"><i className="fa-solid fa-calculator mr-1"></i> Preço em Massa:</span>
                        <button onClick={()=>bulkUpdatePrices('suggested')} className="text-xs bg-blue-100 text-blue-700 px-3 py-2 rounded font-bold hover:bg-blue-200 transition shadow-sm">Usar Sugerido</button>
                        <button onClick={()=>bulkUpdatePrices('suggested20')} className="text-xs bg-purple-100 text-purple-700 px-3 py-2 rounded font-bold hover:bg-purple-200 transition shadow-sm">Sugerido + 20%</button>
                        <button onClick={()=>bulkUpdatePrices('ifood')} className="text-xs bg-orange-100 text-orange-700 px-3 py-2 rounded font-bold hover:bg-orange-200 transition shadow-sm">Usar iFood</button>
                        
                        <div className="w-px h-6 bg-gray-300 mx-1"></div> {/* Separador */}
                        
                        <button onClick={()=>bulkUpdatePrices('fill_ifood')} className="text-xs bg-red-100 text-red-700 px-3 py-2 rounded font-bold hover:bg-red-200 transition shadow-sm flex items-center gap-2">
                            <i className="fa-solid fa-tags"></i> Preencher "Preço iFood" (Mostrar Desconto)
                        </button>
                    </div>
                    
                    <div className="grid gap-2"> 
                        {filteredProducts.map(p => {
                    const m = getMetrics(p); 
                    return ( 
    <div key={p.id} className="flex justify-between items-center border p-3 rounded bg-white shadow-sm transition hover:shadow-md"> 
        <div className="flex items-center gap-3"> 
            {p.imageUrl && <img src={p.imageUrl} className="w-10 h-10 rounded object-cover border"/>} 
            <div> 
                <h4 className="font-bold text-gray-800">{p.name}</h4> 
                <div className="text-xs flex gap-2 mt-1"> 
                    <span className="bg-gray-100 px-2 rounded border text-gray-600">{p.category}</span> 
                    <span className="text-orange-600 font-bold bg-orange-50 px-2 rounded border border-orange-100">iFood: {formatMoney(m.ifood)}</span> 
                </div> 
            </div> 
        </div> 
        <div className="flex items-center gap-3"> 
            <span className="font-bold text-lg text-gray-800">{formatMoney(p.price)}</span> 
            <div className="flex gap-1"> 
                <button onClick={()=>{setData(p);setEdit(true)}} className="text-blue-500 p-2 hover:bg-blue-50 rounded" title="Editar"><i className="fa-solid fa-pen"></i></button> 
                <button onClick={() => { const { id, ...produtoCopiado } = p; setData({ ...produtoCopiado, name: produtoCopiado.name + ' (Cópia)' }); setEdit(true); }} className="text-emerald-500 p-2 hover:bg-emerald-50 rounded" title="Duplicar Produto"><i className="fa-regular fa-copy"></i></button>
                <button onClick={()=>del(p.id)} className="text-red-500 p-2 hover:bg-red-50 rounded" title="Excluir"><i className="fa-solid fa-trash"></i></button> 
            </div> 
        </div> 
    </div> 
); 
                })} 
                </div>
            </>
            )} 
        </div> 
    ); 
}

function AdminIngredients({ ingredients, settings, theme, showAlert, showConfirm }) { 
    const [data, setData] = useState({ name: "", unit: "kg", cost: "" }); 
    const save = async (e) => { 
        e.preventDefault(); const cost = parseFloat(data.cost); 
        if(data.id) { 
            await getCol('ingredients').doc(data.id).update({...data, cost}); 
            showConfirm("Atualizar Preços?", "Deseja recalcular o preço de todos os produtos que usam este insumo?", async () => { 
                const batch = db.batch(); const allProducts = await getCol('products').get(); let count = 0; 
                allProducts.docs.forEach(doc => { 
                    const prod = doc.data(); 
                    if(prod.recipe && prod.recipe.some(r => r.id === data.id) && !prod.isCombo) {
                        const newRecipe = prod.recipe.map(r => r.id === data.id ? {...r, cost, name: data.name} : r); 
                        const totalCost = newRecipe.reduce((acc, item) => { 
                            const ingRef = ingredients.find(i => i.id === item.id); 
                            const currentCost = (item.id === data.id) ? cost : (ingRef ? ingRef.cost : item.cost); 
                            return acc + (currentCost * item.qty); 
                        }, 0); 
                        const newPrice = calculateSmartPrice(totalCost, settings.targetCMV || 35); 
                        batch.update(doc.ref, { recipe: newRecipe, price: newPrice }); 
                        count++; 
                    } 
                }); 
                if(count > 0) { await batch.commit(); showAlert("Sucesso", `${count} produtos atualizados!`, "success"); } 
                else showAlert("Info", "Nenhum produto usava este insumo.", "info"); 
            }); 
        } else { 
            await getCol('ingredients').add({...data, cost}); showAlert("Sucesso", "Criado!", 'success'); 
        } 
        setData({name:"", unit:"kg", cost:""}); 
    }; 
    const del = (id) => showConfirm("Excluir", "Apagar?", async () => await getCol('ingredients').doc(id).delete()); 
    return ( <div> <form onSubmit={save} className="bg-gray-50 p-4 rounded-lg mb-4 border space-y-3"> <div className="grid grid-cols-3 gap-3"> <input placeholder="Nome" className="border p-2 rounded" value={data.name} onChange={e=>setData({...data, name:e.target.value})} /> <select className="border p-2 rounded" value={data.unit} onChange={e=>setData({...data, unit:e.target.value})}><option value="kg">Kg</option><option value="lt">Lt</option><option value="un">Un</option></select> <input type="number" step="0.01" placeholder="Custo" className="border p-2 rounded" value={data.cost} onChange={e=>setData({...data, cost:e.target.value})} /> </div> <button className="w-full text-white px-4 py-2 rounded font-bold" style={theme}>Salvar Insumo</button> </form> <div className="space-y-2">{ingredients.map(i => (<div key={i.id} className="flex justify-between border p-3 rounded bg-white items-center"><div><b>{i.name}</b> <span className="text-xs text-gray-500">({i.unit})</span></div><div className="flex gap-3 items-center"><span className="text-green-600 font-bold">{formatMoney(i.cost)}</span><button onClick={()=>setData(i)} className="text-blue-500"><i className="fa-solid fa-pen"></i></button><button onClick={()=>del(i.id)} className="text-red-500"><i className="fa-solid fa-trash"></i></button></div></div>))}</div> </div> ); 
}

function AdminSauces({ sauceIngredients, sauces, settings, theme, showAlert, showConfirm, ingredients }) {
    const [tab, setTab] = useState('recipe');

    const [ingData, setIngData] = useState({ name: "", unit: "kg", cost: "" });
    
    const saveIng = async (e) => {
        e.preventDefault();
        try {
            const cost = parseFloat(ingData.cost);
            if (isNaN(cost)) {
                return showAlert("Atenção", "O custo precisa ser um número numérico válido.", "warning");
            }

            const payload = { name: ingData.name, unit: ingData.unit, cost: cost };

            if(ingData.id) {
                await getCol('sauce_ingredients').doc(ingData.id).update(payload);
                showAlert("Sucesso", "Insumo do molho atualizado!", "success");
            } else {
                await getCol('sauce_ingredients').add(payload);
                showAlert("Sucesso", "Insumo do molho criado!", 'success');
            }
            setIngData({name:"", unit:"kg", cost:""});
        } catch (error) {
            console.error("Erro ao salvar insumo:", error);
            showAlert("Erro", "Falha ao salvar. Verifique os dados ou atualize a página.", "error");
        }
    };
    
    const delIng = (id) => showConfirm("Excluir", "Apagar este insumo de molho?", async () => await getCol('sauce_ingredients').doc(id).delete());

    const [sauceData, setSauceData] = useState({ name: "", yieldQty: "", yieldUnit: "kg", recipe: [] });
    const [newRecIng, setNewRecIng] = useState({ id: "", qty: "" });

    const addIngToRecipe = () => {
        if(!newRecIng.id || !newRecIng.qty) return;
        const ing = sauceIngredients.find(i => i.id === newRecIng.id);
        const currentRecipe = [...(sauceData.recipe || []), { id: newRecIng.id, name: ing.name, unit: ing.unit, cost: ing.cost, qty: parseFloat(newRecIng.qty) }];
        setSauceData({ ...sauceData, recipe: currentRecipe });
        setNewRecIng({ id: "", qty: "" });
    };
    
    const removeIngFromRecipe = (idx) => {
        const newRecipe = [...sauceData.recipe];
        newRecipe.splice(idx, 1);
        setSauceData({ ...sauceData, recipe: newRecipe });
    };

    const totalCost = (sauceData.recipe || []).reduce((acc, item) => {
        const currentIng = sauceIngredients.find(i => i.id === item.id);
        return acc + ((currentIng ? currentIng.cost : item.cost) * item.qty);
    }, 0);

    const costPerUnit = parseFloat(sauceData.yieldQty) > 0 ? (totalCost / parseFloat(sauceData.yieldQty)) : 0;

    const saveSauce = async (e) => {
        e.preventDefault();
        if(!sauceData.name || !sauceData.yieldQty || sauceData.recipe.length === 0) {
            return showAlert("Aviso", "Preencha nome, rendimento e adicione insumos.", "warning");
        }

        try {
            const finalCost = costPerUnit;
            const finalYield = parseFloat(sauceData.yieldQty);
            let ingredientIdRef = sauceData.ingredientIdRef;

            const mainIngData = { name: ` ${sauceData.name}`, unit: sauceData.yieldUnit, cost: finalCost };

            if (ingredientIdRef) {
                const doc = await getCol('ingredients').doc(ingredientIdRef).get();
                if (doc.exists) await getCol('ingredients').doc(ingredientIdRef).update(mainIngData);
                else { const newDoc = await getCol('ingredients').add(mainIngData); ingredientIdRef = newDoc.id; }
            } else {
                const newDoc = await getCol('ingredients').add(mainIngData);
                ingredientIdRef = newDoc.id;
            }

            const sData = { ...sauceData, yieldQty: finalYield, finalCost: finalCost, ingredientIdRef: ingredientIdRef };
            if(sauceData.id) await getCol('sauces').doc(sauceData.id).update(sData);
            else await getCol('sauces').add(sData);

            if (sauceData.id) {
                showConfirm("Atualizar Produtos?", "O custo do molho mudou. Deseja recalcular o preço dos produtos que usam este molho?", async () => {
                    const batch = db.batch();
                    const allProducts = await getCol('products').get();
                    let count = 0;
                    allProducts.docs.forEach(doc => {
                        const prod = doc.data();
                        if(prod.recipe && prod.recipe.some(r => r.id === ingredientIdRef) && !prod.isCombo) {
                            const newRecipe = prod.recipe.map(r => r.id === ingredientIdRef ? {...r, cost: finalCost, name: mainIngData.name} : r);
                            const tCost = newRecipe.reduce((acc, item) => acc + (item.cost * item.qty), 0);
                            const newPrice = calculateSmartPrice(tCost, settings.targetCMV || 35);
                            batch.update(doc.ref, { recipe: newRecipe, price: newPrice });
                            count++;
                        }
                    });
                    if(count > 0) await batch.commit();
                    showAlert("Sucesso", `Molho salvo e ${count} produtos atualizados!`, "success");
                });
            } else {
                showAlert("Sucesso", "Molho criado e já disponível nos insumos principais!", "success");
            }
            setSauceData({ name: "", yieldQty: "", yieldUnit: "kg", recipe: [] });
            
        } catch (err) {
            console.error("Erro ao salvar receita:", err);
            showAlert("Erro", "Ocorreu um erro inesperado ao salvar o molho.", "error");
        }
    };

    const delSauce = (id) => showConfirm("Excluir Molho", "Excluir esta receita? (O insumo gerado na lista principal precisará ser apagado manualmente).", async () => await getCol('sauces').doc(id).delete());

    return (
        <div className="space-y-4">
            <div className="flex gap-2 mb-4 bg-gray-200 p-1 rounded-lg w-max">
                <button onClick={()=>setTab('recipe')} className={`px-4 py-2 rounded-md font-bold transition ${tab==='recipe'?'bg-white text-gray-800 shadow':'text-gray-500 hover:text-gray-700'}`}><i className="fa-solid fa-blender"></i> Receitas de Molhos</button>
                <button onClick={()=>setTab('ingredients')} className={`px-4 py-2 rounded-md font-bold transition ${tab==='ingredients'?'bg-white text-gray-800 shadow':'text-gray-500 hover:text-gray-700'}`}><i className="fa-solid fa-leaf"></i> Insumos (Base)</button>
            </div>

            {tab === 'ingredients' && (
                <div className="animate-fade-in">
                    <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm mb-4"><i className="fa-solid fa-circle-info"></i> Insumos cadastrados aqui serão usados apenas para criar os molhos.</div>
                    <form onSubmit={saveIng} className="bg-white p-4 rounded-lg mb-4 border shadow-sm space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            <input placeholder="Nome do Insumo" className="border p-2 rounded" value={ingData.name} onChange={e=>setIngData({...ingData, name:e.target.value})} required/>
                            <select className="border p-2 rounded" value={ingData.unit} onChange={e=>setIngData({...ingData, unit:e.target.value})}><option value="kg">Kg</option><option value="lt">Lt</option><option value="un">Un</option></select>
                            <input type="number" step="0.01" placeholder="Custo (R$)" className="border p-2 rounded" value={ingData.cost} onChange={e=>setIngData({...ingData, cost:e.target.value})} required/>
                        </div>
                        <button type="submit" className="w-full text-white px-4 py-2 rounded font-bold" style={theme}>Salvar Insumo do Molho</button>
                    </form>
                    <div className="space-y-2">{sauceIngredients.map(i => (<div key={i.id} className="flex justify-between border p-3 rounded bg-white items-center"><div><b>{i.name}</b> <span className="text-xs text-gray-500">({i.unit})</span></div><div className="flex gap-3 items-center"><span className="text-green-600 font-bold">{formatMoney(i.cost)}</span><button onClick={()=>setIngData(i)} className="text-blue-500"><i className="fa-solid fa-pen"></i></button><button onClick={()=>delIng(i.id)} className="text-red-500"><i className="fa-solid fa-trash"></i></button></div></div>))}</div>
                </div>
            )}

            {tab === 'recipe' && (
                <div className="animate-fade-in">
                    <form onSubmit={saveSauce} className="bg-white p-4 rounded-lg mb-4 border shadow-sm space-y-4">
                        <h3 className="font-bold text-gray-700">{sauceData.id ? 'Editando Molho' : 'Criar Novo Molho'}</h3>
                        <input placeholder="Nome do Molho (Ex: Maionese Verde)" className="border p-2 rounded w-full font-bold" value={sauceData.name} onChange={e=>setSauceData({...sauceData, name:e.target.value})} required/>
                        
                        <div className="bg-gray-50 p-3 rounded border">
                            <h4 className="font-bold text-gray-600 mb-2 text-sm">Receita</h4>
                            <div className="flex gap-2 mb-3">
                                <select className="border p-2 flex-1 rounded" value={newRecIng.id} onChange={e=>setNewRecIng({...newRecIng, id:e.target.value})}><option value="">+ Adicionar Insumo Base</option>{sauceIngredients.map(i=><option key={i.id} value={i.id}>{i.name} ({formatMoney(i.cost)}/{i.unit})</option>)}</select>
                                <input type="number" step="0.001" placeholder="Qtd" className="border p-2 w-24 rounded" value={newRecIng.qty} onChange={e=>setNewRecIng({...newRecIng, qty:e.target.value})} />
                                <button type="button" onClick={addIngToRecipe} className="bg-blue-600 text-white px-4 rounded font-bold hover:bg-blue-700">+</button>
                            </div>
                            <div className="space-y-1">
                                {(sauceData.recipe || []).map((ing, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                                        <span>{ing.qty} {ing.unit} de <b>{ing.name}</b></span>
                                        <button type="button" onClick={()=>removeIngFromRecipe(idx)} className="text-red-500 px-2"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-4 items-end bg-orange-50 p-3 rounded border border-orange-200">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-orange-800">Rendimento Total</label>
                                <input type="number" step="0.001" placeholder="Ex: 1.5" className="border p-2 rounded w-full" value={sauceData.yieldQty} onChange={e=>setSauceData({...sauceData, yieldQty:e.target.value})} required/>
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-bold text-orange-800">Unidade</label>
                                <select className="border p-2 rounded w-full" value={sauceData.yieldUnit} onChange={e=>setSauceData({...sauceData, yieldUnit:e.target.value})}><option value="kg">Kg</option><option value="lt">Lt</option></select>
                            </div>
                            <div className="flex-1 text-right">
                                <div className="text-xs text-gray-500">Custo Total: {formatMoney(totalCost)}</div>
                                <div className="text-sm font-bold text-orange-700">Custo por {sauceData.yieldUnit}: {formatMoney(costPerUnit)}</div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button type="submit" className="flex-1 text-white py-2 rounded font-bold shadow" style={theme}>Salvar Molho</button>
                            {sauceData.id && <button type="button" onClick={()=>setSauceData({name:"", yieldQty:"", yieldUnit:"kg", recipe:[]})} className="px-4 border rounded text-gray-600 font-bold">Cancelar</button>}
                        </div>
                    </form>

                    <div className="grid gap-3">
                        {sauces.map(s => (
                            <div key={s.id} className="border p-4 rounded-xl bg-white shadow-sm flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-lg">{s.name}</h4>
                                    <div className="text-xs text-gray-500 mt-1">Rende: {s.yieldQty} {s.yieldUnit} • Custo da Receita: {formatMoney(s.recipe.reduce((acc, i)=>acc+(i.cost*i.qty),0))}</div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <span className="text-xs text-gray-400 block">Custo p/ {s.yieldUnit}</span>
                                        <span className="font-bold text-green-600 text-lg">{formatMoney(s.finalCost)}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={()=>setSauceData(s)} className="text-blue-500 bg-blue-50 p-2 rounded hover:bg-blue-100"><i className="fa-solid fa-pen"></i></button>
                                        <button onClick={()=>delSauce(s.id)} className="text-red-500 bg-red-50 p-2 rounded hover:bg-red-100"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function AdminCoupons({ theme, showAlert, showConfirm }) { const [coupons, setCoupons] = useState([]); const [form, setForm] = useState({ code: "", type: "fixed", value: "", limit: 100, maxDiscount: "" }); useEffect(() => { const u = getCol('coupons').onSnapshot(s => setCoupons(s.docs.map(d => ({ id: d.id, ...d.data() })))); return () => u(); }, []); const save = async (e) => { e.preventDefault(); if(!form.code) return; const payload = { ...form, code: form.code.toUpperCase(), usageCount: 0, active: true, createdAt: new Date().toISOString(), limit: parseInt(form.limit), value: parseFloat(form.value) }; if(form.maxDiscount) payload.maxDiscount = parseFloat(form.maxDiscount); await getCol('coupons').add(payload); setForm({ code: "", type: "fixed", value: "", limit: 100, maxDiscount: "" }); showAlert("Sucesso","Criado",'success'); }; const del = (id) => showConfirm("Excluir", "Apagar?", async () => await getCol('coupons').doc(id).delete()); return ( <div> <form onSubmit={save} className="bg-gray-50 p-4 rounded-lg mb-4 border space-y-3 shadow-sm"> <h4 className="font-bold text-gray-700">Novo Cupom</h4> <div className="grid grid-cols-2 gap-3"> <input placeholder="CÓDIGO (Ex: WELCOME10)" className="border p-2 rounded uppercase font-bold" value={form.code} onChange={e=>setForm({...form, code:e.target.value})} /> <select className="border p-2 rounded" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}> <option value="fixed">Valor Fixo (R$)</option> <option value="percent">Porcentagem (%)</option> <option value="shipping">Entrega Grátis</option> </select> </div> <div className="grid grid-cols-3 gap-3"> <input type="number" placeholder={form.type==='percent'?'Valor %':'Valor R$'} className="border p-2 rounded" value={form.value} onChange={e=>setForm({...form, value:e.target.value})} disabled={form.type==='shipping'} /> <input type="number" placeholder="Qtd Limite" className="border p-2 rounded" value={form.limit} onChange={e=>setForm({...form, limit:e.target.value})} /> <input type="number" placeholder="Teto Máx (R$)" className="border p-2 rounded" value={form.maxDiscount} onChange={e=>setForm({...form, maxDiscount:e.target.value})} disabled={form.type==='fixed'} /> </div> <button className="w-full text-white py-2 rounded font-bold" style={theme}>Criar Cupom</button> </form> <div className="grid gap-3"> {coupons.map(c => { const usage = c.usageCount || 0; const limit = c.limit || 100; const percent = Math.min(100, (usage/limit)*100); return ( <div key={c.id} className="border p-3 rounded bg-white shadow-sm"> <div className="flex justify-between mb-2"> <div> <b className="text-lg text-gray-800">{c.code}</b> <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"> {c.type==='shipping' ? 'Entrega Grátis' : c.type==='percent' ? `${c.value}% OFF` : `R$ ${c.value} OFF`} </span> </div> <button onClick={()=>del(c.id)} className="text-red-500"><i className="fa-solid fa-trash"></i></button> </div> <div className="w-full bg-gray-200 rounded-full h-2.5"> <div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${percent}%`}}></div> </div> <div className="flex justify-between text-xs text-gray-500 mt-1"> <span>Usado: {usage} / {limit}</span> <span>{percent.toFixed(0)}% esgotado</span> </div> </div> ); })} </div> </div> ); }

function AdminCustomers({ showAlert }) { const [all, setAll] = useState([]); const [filter, setFilter] = useState("all"); useEffect(() => { const u = getCol('customers').limit(2000).onSnapshot(s => setAll(s.docs.map(d => ({ id: d.id, ...d.data() })))); return () => u(); }, []); const filtered = useMemo(() => { let list = [...all]; if (filter === "top") return list.filter(c => (c.orderCount || 0) >= 2).sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0)).slice(0, 100); if (filter === "inactive") { const d = new Date(); d.setDate(d.getDate() - 30); return list.filter(c => new Date(c.lastOrder) < d); } return list; }, [all, filter]); const exp = () => { const t = "Nome;Telefone;Endereço;Bairro;Total Pedidos;Ultimo Pedido\n" + filtered.map(x => `${x.name};${x.phone};${x.address}, ${x.number};${x.bairro};${x.orderCount||0};${new Date(x.lastOrder).toLocaleDateString()}`).join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURI("\uFEFF"+t); a.download = `clientes_${filter}.csv`; a.click(); }; return ( <div> <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 p-2 rounded border"> <button onClick={()=>setFilter("all")} className={`px-3 py-1 rounded text-sm font-bold ${filter==="all"?"bg-gray-800 text-white":"bg-white border"}`}>Todos</button> <button onClick={()=>setFilter("top")} className={`px-3 py-1 rounded text-sm font-bold ${filter==="top"?"bg-gray-800 text-white":"bg-white border"}`}>Top 100</button> <button onClick={()=>setFilter("inactive")} className={`px-3 py-1 rounded text-sm font-bold ${filter==="inactive"?"bg-gray-800 text-white":"bg-white border"}`}>Inativos (+30d)</button> <button onClick={exp} className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold ml-auto"><i className="fa-solid fa-file-csv"></i> CSV</button> </div> <div className="h-96 overflow-y-auto space-y-2 border rounded bg-gray-50 p-2">{filtered.map(x=>( <div key={x.id} className="bg-white p-3 rounded shadow-sm flex justify-between items-center"> <div><b className="text-gray-800">{x.name}</b> <span className="text-xs text-gray-500">({x.orderCount||1} pedidos)</span><br/><span className="text-sm text-gray-600">{x.phone}</span></div> <div className="text-right text-xs text-gray-400">Último: {new Date(x.lastOrder).toLocaleDateString()}</div> </div> ))}</div> </div> ); }

function AdminConfig({ settings, categories, theme, showAlert, showConfirm, ingredients, products }) { 
    const [data, setData] = useState(settings); const [tab, setTab] = useState('visual'); const [nC, setNC] = useState(""); 
    const handleChange = (k, v) => setData(p=>({...p, [k]:v})); 
    const save = () => { getConfigDoc().set(data, {merge:true}); showAlert("Sucesso", "Atualizado!", "success"); }; 
    const addC = () => { if(nC) getCol('categories').add({ name: nC, order: categories.length }); setNC(""); }; 
    const delC = (id) => showConfirm("Excluir", "Apagar?", async () => await getCol('categories').doc(id).delete()); 
    const move = (idx, dir) => { if((dir===-1&&idx===0)||(dir===1&&idx===categories.length-1))return; const items = [...categories]; const temp = items[idx]; items[idx] = items[idx+dir]; items[idx+dir] = temp; const b = db.batch(); items.forEach((cat, i) => b.update(getCol('categories').doc(cat.id), {order: i})); b.commit(); }; 
    const ColorInput = ({ label, propKey }) => (<div><label className="text-xs text-gray-500">{label}</label><div className="flex gap-2 items-center"><input type="color" value={data[propKey]||"#000000"} onChange={e=>handleChange(propKey,e.target.value)} /><input type="text" className="border rounded px-2 py-1 text-sm font-mono flex-1 uppercase" value={data[propKey]||""} onChange={e=>handleChange(propKey,e.target.value)} placeholder="#000000" maxLength={7} /></div></div>); 
    const addKey = (key) => { const area = document.getElementById('msg-template-area'); if(area) { const start = area.selectionStart; const end = area.selectionEnd; const text = data.whatsappTemplate || ""; const newText = text.substring(0, start) + key + text.substring(end); handleChange("whatsappTemplate", newText); setTimeout(() => { area.focus(); area.setSelectionRange(start+key.length, start+key.length); }, 50); } else handleChange("whatsappTemplate", (data.whatsappTemplate || "") + key); };
    const placeholders = [{k: "{nome}", l: "Nome"}, {k: "{telefone}", l: "Fone"}, {k: "{endereco}", l: "Rua e Nº"}, {k: "{bairro}", l: "Bairro"}, {k: "{complemento}", l: "Obs (Se houver)"}, {k: "{itens}", l: "Lista de Itens"}, {k: "{total}", l: "Valor Final"}, {k: "{subtotal}", l: "Subtotal"}, {k: "{entrega}", l: "Taxa"}, {k: "{pagamento}", l: "Forma Pagto"}, {k: "{troco}", l: "Troco (Se houver)"}, {k: "{cupom}", l: "Cupom (Se houver)"}, {k: "{link_rastreio}", l: "Link"}];
    const defaultTemplate = "*NOVO PEDIDO - {nome_app}*\n{nome}\n{telefone}\n\n📍 {endereco} - {bairro}\n{complemento}\n\n🛒 *ITENS:*\n{itens}\n\n💰 *RESUMO:*\nSubtotal: {subtotal}\nEntrega: {entrega}\n*TOTAL: {total}*\n\n💳 {pagamento}\n{troco}\n{cupom}\n\n🛵 *Acompanhe:*\n{link_rastreio}";
    
    const bulkUpdate = async () => { 
        showConfirm("Recalcular TUDO?", "Isso atualizará o preço de TODOS os produtos (e combos) com base no CMV de " + (data.targetCMV||35) + "%.", async () => { 
            const batch = db.batch(); let count = 0; 
            products.forEach(p => { 
                if((p.recipe && p.recipe.length > 0) || (p.isCombo && p.comboItems && p.comboItems.length > 0)) { 
                    // Você precisará copiar a função getProductCost para dentro do AdminConfig se ela não estiver lá, 
                    // ou fazer a lógica resumida de custo aqui dentro.
                    
                    // Cálculo resumido de custo que ignora a recursividade complexa para o bulkUpdate:
                    const totalCost = p.isCombo ? 
                        (p.comboItems || []).reduce((acc, item) => {
                            const prodRef = products.find(x => x.id === item.id);
                            const pCost = prodRef ? (prodRef.recipe || []).reduce((a, i) => {
                                const ing = ingredients.find(ingr => ingr.id === i.id); return a + ((ing ? ing.cost : i.cost) * i.qty);
                            }, 0) : 0;
                            return acc + (pCost * item.qty);
                        }, 0) 
                        : 
                        (p.recipe || []).reduce((acc, item) => {
                            const ing = ingredients.find(i => i.id === item.id); return acc + ((ing ? ing.cost : item.cost) * item.qty);
                        }, 0);

                    const newPrice = calculateSmartPrice(totalCost, data.targetCMV || 35); 
                    batch.update(getCol('products').doc(p.id), { price: newPrice }); 
                    count++; 
                } 
            }); 
            if(count > 0) { await batch.commit(); showAlert("Sucesso", `${count} produtos/combos atualizados!`, "success"); } 
            else showAlert("Info", "Nenhum produto com receita para atualizar.", "info"); 
        }); 
    };

    return ( 
        <div className="space-y-4">
            <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
                {[{id: 'visual', icon: 'fa-paintbrush', label: 'Visual'}, {id: 'message', icon: 'fa-whatsapp', label: 'Mensagem WhatsApp'}, {id: 'operation', icon: 'fa-clock', label: 'Operação'}, {id: 'payment', icon: 'fa-credit-card', label: 'Pagamento'}, {id: 'categories', icon: 'fa-list', label: 'Categorias'}].map(t => (
                    <button key={t.id} onClick={()=>setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold whitespace-nowrap transition ${tab===t.id ? 'bg-gray-800 text-white shadow-lg' : 'bg-white text-gray-600 border'}`}><i className={`fa-solid ${t.icon}`}></i> {t.label}</button>
                ))}
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4 animate-fade-in relative overflow-hidden">
                {tab === 'visual' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Nome do App</label><input className="border w-full p-2 rounded" value={data.appName||""} onChange={e=>handleChange("appName",e.target.value)} /></div>
                            <div className="md:col-span-2"><label className="text-xs font-bold text-gray-500 uppercase">Frase do Cabeçalho</label><input className="border w-full p-2 rounded" value={data.headerPhrase||""} onChange={e=>handleChange("headerPhrase",e.target.value)} /></div>
                        </div>
                        <hr/><h4 className="font-bold text-gray-800">Cores</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><ColorInput label="Cor Principal" propKey="themeColor" /><ColorInput label="Cor Fundo" propKey="bgColor" /><ColorInput label="Cor Botão Carrinho" propKey="cartColor" /><ColorInput label="Cor Texto do Título" propKey="appNameColor" /></div>
                        <hr/><div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-gray-500">Estilo dos Cards</label><select className="border w-full p-2 rounded" value={data.cardStyle||"grid"} onChange={e=>handleChange("cardStyle",e.target.value)}><option value="grid">Grade</option><option value="list">Lista</option><option value="minimal">Minimal</option></select></div><div><label className="text-xs text-gray-500">Bordas</label><select className="border w-full p-2 rounded" value={data.borderRadius||"rounded-2xl"} onChange={e=>handleChange("borderRadius",e.target.value)}><option value="rounded-2xl">Moderno</option><option value="rounded-lg">Suave</option><option value="rounded-none">Quadrado</option></select></div></div>
                        <hr/><div className="grid grid-cols-1 gap-3"><div><label className="text-xs text-gray-500">Logo URL</label><input className="border w-full p-2 rounded text-sm" value={data.logoUrl||""} onChange={e=>handleChange("logoUrl",e.target.value)} /></div><div><label className="text-xs text-gray-500">Banner URL</label><input className="border w-full p-2 rounded text-sm" value={data.bannerUrl||""} onChange={e=>handleChange("bannerUrl",e.target.value)} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-gray-500">Estilo Logo</label><select className="border w-full p-2 rounded" value={data.logoStyle||"circle"} onChange={e=>handleChange("logoStyle",e.target.value)}><option value="circle">Circular</option><option value="square">Quadrado</option><option value="raw">Puro</option><option value="none">Texto</option></select></div><div><label className="text-xs text-gray-500">Tamanho Logo</label><input type="number" className="border w-full p-2 rounded" value={data.logoSize||60} onChange={e=>handleChange("logoSize",e.target.value)} /></div></div>
                    </div>
                )}
                {tab === 'message' && (
                    <div className="space-y-3">
                        <div className="bg-green-50 p-3 rounded text-sm text-green-800 border border-green-200"><i className="fa-brands fa-whatsapp mr-1"></i> Configure aqui a integração automática.</div>
                        <div className="mb-4">
                            <label className="font-bold text-gray-700 block mb-1">Link do Servidor WhatsApp (API Tunnel)</label>
                            <input className="border w-full p-3 rounded-lg font-mono text-sm bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Ex: https://fritzza.trycloudflare.com/send" value={data.whatsappServerUrl || ""} onChange={e=>handleChange("whatsappServerUrl", e.target.value)} />
                        </div>
                        <label className="font-bold text-gray-700 block">Modelo da Mensagem (O que o cliente envia)</label>
                        <textarea id="msg-template-area" className="w-full h-64 border p-4 rounded-lg font-mono text-sm bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none" value={data.whatsappTemplate || defaultTemplate} onChange={e=>handleChange("whatsappTemplate", e.target.value)}></textarea>
                        <div className="flex flex-wrap gap-2 mt-2 p-2 bg-gray-100 rounded border">
                            {placeholders.map(p => (
                                <button key={p.k} onClick={()=>addKey(p.k)} className="bg-white hover:bg-gray-50 text-gray-700 px-2 py-1 rounded text-xs font-bold border shadow-sm transition active:scale-95" title={p.l}>{p.k}</button>
                            ))}
                        </div>
                    </div>
                )}
                {tab === 'operation' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-gray-500">Abre às</label><input type="time" className="border w-full p-2 rounded" value={data.openTime||"18:00"} onChange={e=>handleChange("openTime",e.target.value)} /></div><div><label className="text-xs font-bold text-gray-500">Fecha às</label><input type="time" className="border w-full p-2 rounded" value={data.closeTime||"23:00"} onChange={e=>handleChange("closeTime",e.target.value)} /></div></div>
                        <hr/><h4 className="font-bold text-gray-800">Localização</h4>
                        <div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-gray-500">Latitude</label><input className="border w-full p-2 rounded" value={data.restLat||""} onChange={e=>handleChange("restLat",e.target.value)} /></div><div><label className="text-xs text-gray-500">Longitude</label><input className="border w-full p-2 rounded" value={data.restLng||""} onChange={e=>handleChange("restLng",e.target.value)} /></div></div>
                        <div className="grid grid-cols-2 gap-4 items-end">
                            <div><label className="text-xs font-bold text-gray-500">Preço por KM (R$)</label><input type="number" step="0.10" className="border w-full p-2 rounded font-bold" value={data.pricePerKm||2.00} onChange={e=>handleChange("pricePerKm",e.target.value)} /></div>
                            <div><label className="text-xs font-bold text-red-600">Meta CMV (%)</label><input type="number" className="border w-full p-2 rounded font-bold border-red-200 bg-red-50" value={data.targetCMV||35} onChange={e=>handleChange("targetCMV",e.target.value)} /></div>
                        </div>
                        <button onClick={bulkUpdate} className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold shadow hover:bg-orange-600 mt-4"><i className="fa-solid fa-calculator mr-2"></i> Recalcular Preços de TUDO (Baseado no CMV)</button>
                    </div>
                )}
                {tab === 'payment' && (
                    <div className="space-y-4">
                        <div><label className="text-xs font-bold text-gray-500">Chave Pix Manual</label><input className="border w-full p-2 rounded" value={data.pixKey||""} onChange={e=>handleChange("pixKey",e.target.value)} /></div>
                        <hr/><div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><h4 className="font-bold text-gray-800 mb-2">Mercado Pago (Pix Auto)</h4><label className="text-xs font-bold text-gray-500">Access Token</label><input className="border w-full p-2 rounded font-mono text-sm bg-white" value={data.mercadoPagoToken||""} onChange={e=>handleChange("mercadoPagoToken",e.target.value)} type="password" /></div>
                    </div>
                )}
                {tab === 'categories' && (
                    <div><h3 className="font-bold border-b pb-2 mb-3">Gerenciar Categorias</h3><div className="flex gap-2 mb-4"><input className="border p-2 flex-1 rounded" placeholder="Nova Categoria..." value={nC} onChange={e=>setNC(e.target.value)} /><button onClick={addC} className="text-white px-4 rounded font-bold shadow" style={theme}>+</button></div><div className="space-y-2 max-h-60 overflow-y-auto">{categories.map((c,i)=><div key={c.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border"><span>{c.name}</span><div className="flex gap-1"><button onClick={()=>move(i,-1)} className="text-gray-400 hover:text-gray-600 px-2"><i className="fa-solid fa-arrow-up"></i></button><button onClick={()=>move(i,1)} className="text-gray-400 hover:text-gray-600 px-2"><i className="fa-solid fa-arrow-down"></i></button><button onClick={(e)=>{e.stopPropagation(); delC(c.id)}} className="text-red-500 hover:text-red-700 ml-2"><i className="fa-solid fa-trash"></i></button></div></div>)}</div></div> 
                )} 
                <div className="mt-6 pt-4 border-t"><button onClick={save} className="w-full py-3 rounded-lg text-white font-bold shadow-md hover:opacity-90" style={theme}><i className="fa-solid fa-save mr-2"></i> Salvar</button></div> 
            </div> 
        </div> 
    ); 
}

function App() {
    const [user, setUser] = useState(null); 
    const [view, setView] = useState('dashboard'); 
    const [products, setProducts] = useState([]); 
    const [categories, setCategories] = useState([]); 
    const [ingredients, setIngredients] = useState([]); 
    const [sauceIngredients, setSauceIngredients] = useState([]);
    const [sauces, setSauces] = useState([]);
    const [settings, setSettings] = useState({}); 
    const [loading, setLoading] = useState(true); 
    const [sidebarOpen, setSidebarOpen] = useState(false); 
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });
    const [onlineCount, setOnlineCount] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchOnlineCount = async () => {
        try {
            const res = await fetch('https://rodaa.onrender.com/api/presence');
            if (res.ok) {
                const data = await res.json();
                setOnlineCount(data.count);
            }
        } catch(e) { console.error("Erro ao buscar visitantes online"); }
    };

    const handleStrictRefresh = async () => {
        setIsRefreshing(true);
        await fetchOnlineCount();
        Toastify({ text: "Visitantes atualizados! 🔄", duration: 3000, style: { background: "#059669", borderRadius: "10px" } }).showToast();
        setIsRefreshing(false);
    };

    useEffect(() => {
                let uid = localStorage.getItem('fritzza_session_id');
                if (!uid) {
                    uid = 'sess_' + Math.random().toString(36).substr(2, 9);
                    localStorage.setItem('fritzza_session_id', uid);
                }

                const reportPresence = () => {
                    if (document.visibilityState === 'visible') {
                        fetch('https://rodaa.onrender.com/api/presence', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ uid: uid })
                        }).catch(() => {});
                    }
                };

                const leavePresence = () => {
    fetch('https://rodaa.onrender.com/api/presence/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid }),
        keepalive: true
    }).catch(() => {});
};

                reportPresence(); // Avisa que entrou
                const interval = setInterval(reportPresence, 15000); // Avisa a cada 15s

                // Eventos mágicos: Detectam se a pessoa fechou a aba, minimizou ou bloqueou a tela
                const handleVisibilityChange = () => {
                    if (document.visibilityState === 'hidden') {
                        leavePresence();
                    } else {
                        reportPresence(); // Voltou pro site
                    }
                };

                window.addEventListener('visibilitychange', handleVisibilityChange);
                window.addEventListener('pagehide', leavePresence); // Suporte extra para iOS/Safari

                return () => {
                    clearInterval(interval);
                    window.removeEventListener('visibilitychange', handleVisibilityChange);
                    window.removeEventListener('pagehide', leavePresence);
                    leavePresence();
                };
            }, []);

    const showAlert = (title, message, type='info') => setModal({ isOpen: true, title, message, type });
    const showConfirm = (title, message, onConfirm) => setModal({ isOpen: true, title, message, type: 'confirm', onConfirm });
    const showLoading = (title, message = 'Aguarde um momento...') => setModal({ isOpen: true, title, message, type: 'loading' });
    const closeModal = () => setModal({ ...modal, isOpen: false });
    
    useEffect(() => { auth.onAuthStateChanged(u => { setUser(u); if(u) fetchData(); else setLoading(false); }); }, []);
    
    // Nova lógica para puxar os Visitantes Online direto da sua API do Render
    useEffect(() => {
        fetchOnlineCount(); // Puxa assim que abrir o painel
        const intervalId = setInterval(fetchOnlineCount, 15000); // Atualiza a cada 15 segundos sozinho
        return () => clearInterval(intervalId);
    }, []);

    const fetchData = () => {
        const unsubs = [];
        unsubs.push(getCol('products').onSnapshot(s => setProducts(s.docs.map(d=>({id:d.id, ...d.data()})))));
        unsubs.push(getCol('categories').orderBy('order').onSnapshot(s => setCategories(s.docs.map(d=>({id:d.id, ...d.data()})))));
        unsubs.push(getCol('ingredients').onSnapshot(s => setIngredients(s.docs.map(d=>({id:d.id, ...d.data()})))));
        unsubs.push(getCol('sauce_ingredients').onSnapshot(s => setSauceIngredients(s.docs.map(d=>({id:d.id, ...d.data()})))));
        unsubs.push(getCol('sauces').onSnapshot(s => setSauces(s.docs.map(d=>({id:d.id, ...d.data()})))));
        
        unsubs.push(getConfigDoc().onSnapshot(d => { if(d.exists) setSettings(d.data()); setLoading(false); }));
        return () => unsubs.forEach(u => u());
    };

    const handleLogin = async (email, password) => { setLoading(true); try { await auth.signInWithEmailAndPassword(email, password); } catch (error) { showAlert("Erro", "Login inválido.", "error"); setLoading(false); } };
    const themeStyle = { backgroundColor: settings.themeColor || '#dc2626' };
    
    if (loading && !user) return <div className="min-h-screen flex items-center justify-center text-gray-400"><i className="fa-solid fa-spinner fa-spin text-3xl"></i></div>;
    if (!user) return <><LoginView onLogin={handleLogin} loading={loading} /><GlobalModal modal={modal} close={closeModal} /></>;

    const MenuBtn = ({ id, icon, label }) => (<button onClick={() => { setView(id); setSidebarOpen(false); }} className={`w-full text-left p-3 rounded-lg mb-1 flex items-center gap-3 transition ${view === id ? 'bg-white text-red-600 shadow font-bold' : 'text-white hover:bg-white/10'}`}><i className={`fa-solid ${icon} w-6 text-center`}></i> {label}</button>);
    
    return (
        <div className="min-h-screen flex bg-gray-100">
            <GlobalModal modal={modal} close={closeModal} />
            <div className="fixed w-full bg-white z-40 p-4 shadow-sm flex justify-between items-center md:hidden"><div className="font-bold text-gray-800">{settings.appName || 'Admin'}</div><button onClick={()=>setSidebarOpen(!sidebarOpen)} className="text-gray-600"><i className="fa-solid fa-bars text-xl"></i></button></div>
            
            <div className={`sidebar fixed md:relative w-64 h-screen flex flex-col justify-between z-50 shadow-xl md:shadow-none ${sidebarOpen ? 'open' : ''}`} style={themeStyle}>
                <div className="p-4">
                    <div className="text-white font-bold text-2xl mb-8 flex items-center gap-2 px-2"><i className="fa-solid fa-pizza-slice"></i> {settings.appName || 'Fritzza'}</div>
                    <nav>
                        <MenuBtn id="dashboard" icon="fa-chart-pie" label="Resumo" />
                        <MenuBtn id="orders" icon="fa-list-check" label="Pedidos" />
                        <MenuBtn id="products" icon="fa-burger" label="Produtos" />
                        <MenuBtn id="ingredients" icon="fa-carrot" label="Insumos" />
                        <MenuBtn id="sauces" icon="fa-blender" label="Molhos Caseiros" />
                        
                        <MenuBtn id="config" icon="fa-wand-magic-sparkles" label="Personalizar App" />
                        <div className="border-t border-white/20 my-2 pt-2">
                            <MenuBtn id="coupons" icon="fa-ticket" label="Cupons" />
                            <MenuBtn id="customers" icon="fa-users" label="Clientes" />
                        </div>
                    </nav>
                </div>
                
                <div className="p-4 bg-black/10 border-t border-white/10 text-white">
                     <div className="flex items-center justify-center gap-2 text-xs mb-3 bg-black/20 p-2 rounded-full border border-white/10">
                        <span className="pulse-dot"></span> {onlineCount} Visitantes Online
                        <button onClick={handleStrictRefresh} disabled={isRefreshing} className="ml-2 hover:text-white text-gray-400 transition disabled:opacity-50" title="Verificar quem está ativo AGORA (Últimos 2 min)">
                            <i className={`fa-solid fa-rotate-right ${isRefreshing ? 'fa-spin' : ''}`}></i>
                        </button>
                     </div>
                     <button onClick={() => auth.signOut()} className="w-full text-left p-3 rounded-lg flex items-center gap-3 text-white hover:bg-white/20 transition font-bold text-red-100 hover:text-white">
                        <i className="fa-solid fa-right-from-bracket w-6 text-center"></i> Sair do Sistema
                    </button>
                </div>
            </div>
            
            {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={()=>setSidebarOpen(false)}></div>}
            
            <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto h-screen">
                <header className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">
                        {view === 'dashboard' && 'Resumo Geral'}
                        {view === 'orders' && 'Gerenciar Pedidos'}
                        {view === 'products' && 'Cardápio & Fichas'}
                        {view === 'ingredients' && 'Insumos Principais & Custos'}
                        {view === 'sauces' && 'Calculadora de Molhos Caseiros'}
                        {view === 'config' && 'Personalizar Site Cliente'}
                        {view === 'coupons' && 'Cupons de Desconto'}
                        {view === 'customers' && 'Base de Clientes'}
                    </h1>
                </header>
                <div className="max-w-5xl mx-auto">
                    {view === 'dashboard' && <AdminDashboard theme={themeStyle} />}
                    {view === 'orders' && <AdminOrders showConfirm={showConfirm} settings={settings} />}
                    
                    {/* ADICIONADO O showLoading e closeModal COMO PROPS PARA O ADMIN PRODUCTS */}
                    {view === 'products' && <AdminProducts products={products} categories={categories} ingredients={ingredients} settings={settings} theme={themeStyle} showAlert={showAlert} showConfirm={showConfirm} showLoading={showLoading} closeModal={closeModal} />}
                    
                    {view === 'ingredients' && <AdminIngredients ingredients={ingredients} settings={settings} theme={themeStyle} showAlert={showAlert} showConfirm={showConfirm} />}
                    {view === 'sauces' && <AdminSauces sauceIngredients={sauceIngredients} sauces={sauces} settings={settings} theme={themeStyle} showAlert={showAlert} showConfirm={showConfirm} ingredients={ingredients} />}
                    {view === 'config' && <AdminConfig settings={settings} categories={categories} theme={themeStyle} showAlert={showAlert} showConfirm={showConfirm} ingredients={ingredients} products={products} />}
                    {view === 'coupons' && <AdminCoupons theme={themeStyle} showAlert={showAlert} showConfirm={showConfirm} />}
                    {view === 'customers' && <AdminCustomers showAlert={showAlert} />}
                </div>
            </main>
        </div>
    );
}