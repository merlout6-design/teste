import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth, db } from './firebase';
import firebase from 'firebase/compat/app';

const APP_ID = "rodaodef"; 
const getCol = (n) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection(n);

        const formatMoney = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const DEFAULT_COORDS = { lat: -25.0015570, lng: -53.4628300 };

        // --- UTILITÁRIOS ---
        const isStoreOpen = (start, end) => {
            if(!start || !end) return true; 
            const now = new Date();
            const current = now.getHours() * 60 + now.getMinutes();
            const [sH, sM] = start.split(':').map(Number);
            const [eH, eM] = end.split(':').map(Number);
            const startMin = sH * 60 + sM;
            const endMin = eH * 60 + eM;
            if (endMin < startMin) return current >= startMin || current <= endMin;
            else return current >= startMin && current <= endMin;
        };

        const formatTunnelMessage = (template, data, cartItems, totals, payInfo, link) => {
            let msg = template || "*NOVO PEDIDO*\n{nome}\n{telefone}\n\n{itens}\n\nTotal: {total}\nLink: {link_rastreio}";
            const itemsList = cartItems.map(i => `${i.quantity}x ${i.name}`).join('\n');
            
            msg = msg.replace(/{nome_app}/g, settings.appName || 'Fritzza')
                     .replace(/{nome}/g, data.name)
                     .replace(/{telefone}/g, data.phone)
                     .replace(/{endereco}/g, `${data.address}, ${data.number}`)
                     .replace(/{bairro}/g, data.bairro)
                     .replace(/{complemento}/g, data.complement||"")
                     .replace(/{itens}/g, itemsList)
                     .replace(/{subtotal}/g, formatMoney(totals.sub))
                     .replace(/{entrega}/g, formatMoney(totals.del))
                     .replace(/{desconto}/g, formatMoney(totals.discount))
                     .replace(/{total}/g, formatMoney(totals.total))
                     .replace(/{pagamento}/g, payInfo.method)
                     .replace(/{troco}/g, payInfo.change||"")
                     .replace(/{cupom}/g, payInfo.coupon||"")
                     .replace(/{link_rastreio}/g, link);
                     
            return msg.replace(/\n\s*\n/g, '\n\n').trim();
        };

        // --- COMPONENTES UI ---
        const GlobalModal = ({ modal, close }) => {
            if (!modal.isOpen) return null;
            return (
                <div className="modal-overlay" onClick={modal.type === 'alert' ? close : undefined}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        {modal.type === 'loading' ? (
                            <div className="py-4">
                                <div className="loader border-blue-500 border-b-transparent mb-4 mx-auto" style={{borderColor: modal.color || '#3b82f6', borderBottomColor: 'transparent'}}></div>
                                <h3 className="text-lg font-bold text-gray-800">{modal.title}</h3>
                            </div>
                        ) : (
                            <>
                                <div className={`text-5xl mb-4 ${modal.type === 'error' ? 'text-red-500' : modal.type === 'success' ? 'text-green-500' : 'text-blue-500'}`}>
                                    {modal.icon ? <i className={modal.icon}></i> : 
                                     modal.type === 'error' ? <i className="fa-regular fa-circle-xmark"></i> :
                                     modal.type === 'success' ? <i className="fa-regular fa-circle-check"></i> :
                                     <i className="fa-solid fa-circle-info"></i>}
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">{modal.title}</h3>
                                <p className="text-gray-500 text-sm mb-6 px-2">{modal.message}</p>
                                <div className="flex gap-3">
                                    {modal.type === 'confirm' && (
                                        <button onClick={close} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-bold hover:bg-gray-50 transition">Cancelar</button>
                                    )}
                                    <button 
                                        onClick={() => { if(modal.onConfirm) modal.onConfirm(); close(); }} 
                                        className={`flex-1 py-3 rounded-xl text-white font-bold shadow-lg transform active:scale-95 transition ${modal.type === 'error' ? 'bg-red-500' : 'bg-blue-600'}`}
                                        style={modal.confirmStyle}
                                    >
                                        {modal.confirmText || 'OK'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            );
        };

        const Toast = ({ msg }) => {
            if (!msg) return null;
            return (
                <div className="fixed top-0 left-1/2 bg-gray-900/95 backdrop-blur text-white px-6 py-3 rounded-full shadow-2xl z-[10000] flex items-center gap-3 toast-enter border border-white/10">
                    <div className="bg-green-500 rounded-full p-1"><i className="fa-solid fa-check text-xs"></i></div>
                    <span className="font-medium text-sm">{msg}</span>
                </div>
            );
        };

        const MagicBag = ({ count, isAnimating, color }) => (
            <div className={`bag-container relative w-10 h-10 ${isAnimating ? 'bag-jump' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-md">
                    <path className="bag-handle" d="M8 7V5C8 3.34315 9.34315 2 11 2H13C14.6569 2 16 3.34315 16 5V7" stroke={color} strokeWidth="2" strokeLinecap="round" />
                    <path d="M5 7H19L20 21H4L5 7Z" fill="white" stroke={color} strokeWidth="2" strokeLinejoin="round" />
                    <path d="M9 11C9 11 10 12 12 12C14 12 15 11 15 11" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
                </svg>
                <div className="absolute top-[10px] left-0 right-0 flex justify-center items-center">
                    <span className="text-[10px] font-bold text-gray-800 leading-none">{count}</span>
                </div>
            </div>
        );

        // --- APP PRINCIPAL ---
        const App = () => {
            const [view, setView] = useState("menu");
            const [activeOrder, setActiveOrder] = useState(null); 
            const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('fritzza_cart')) || []; } catch(e) { return []; } });
            
            const [modal, setModal] = useState({ isOpen: false, type: 'alert' });
            const [toast, setToast] = useState(null);
            const toastTimeoutRef = useRef(null);
            const [bagAnim, setBagAnim] = useState(false);
            
            const [products, setProducts] = useState([]);
            const [categories, setCategories] = useState([]);
            const [neighborhoods, setNeighborhoods] = useState([]);
            const [settings, setSettings] = useState({ appName: "Fritzza", themeColor: "#dc2626", openTime: "18:00", closeTime: "23:00", cardStyle: "grid", borderRadius: "rounded-2xl", restLat: DEFAULT_COORDS.lat, restLng: DEFAULT_COORDS.lng, pricePerKm: 2.00 });
            
            const [loading, setLoading] = useState(true);
            const hasShownClosedAlert = useRef(false); // NOVO: Controle do pop-up de fechado

            const showAlert = (title, message, type='alert', icon=null) => setModal({ isOpen: true, type, title, message, icon });
            const showConfirm = (title, message, onConfirm) => setModal({ isOpen: true, type: 'confirm', title, message, onConfirm });
            const showLoading = (title='Carregando...') => setModal({ isOpen: true, type: 'loading', title, color: settings.themeColor });
            const closeModal = () => setModal({ ...modal, isOpen: false });
			
			// --- NOVO: RASTREAMENTO DE VISITAS E CARRINHOS (MÉTRICAS) ---
            useEffect(() => {
                const uid = localStorage.getItem('fritzza_session_id');
                const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                
                // 1. Registra a visita (apenas 1 vez por sessão por dia)
                const visitedToday = sessionStorage.getItem('visited_today');
                if (!visitedToday) {
                    getCol('daily_stats').doc(today).set({
                        visits: firebase.firestore.FieldValue.increment(1),
                        date: today
                    }, { merge: true }).catch(() => {});
                    sessionStorage.setItem('visited_today', 'true');
                }
            }, []);

            // 2. Rastreia o Carrinho (Se tiver itens, salva no banco. Se esvaziar, apaga)
    useEffect(() => {
        let uid = localStorage.getItem('fritzza_session_id');
        
        // CORREÇÃO: Se for o primeiro acesso e não tiver UID, cria um na hora!
        if (!uid) {
            uid = 'sess_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('fritzza_session_id', uid);
        }

        if (cart.length > 0) {
            getCol('active_carts').doc(uid).set({
                updatedAt: new Date().toISOString(),
                itemCount: cart.reduce((a,b)=>a+b.quantity,0),
                total: cart.reduce((a,b)=>a+(b.price*b.quantity),0),
                items: cart.map(i => `${i.quantity}x ${i.name}`)
            }).catch(() => {});
        } else {
            getCol('active_carts').doc(uid).delete().catch(() => {});
        }
    }, [cart]);
			
            // NOVO: Verifica se está fechado logo após terminar o loading inicial
            useEffect(() => {
                if (!loading && !hasShownClosedAlert.current) {
                    if (!isStoreOpen(settings.openTime, settings.closeTime)) {
                        showAlert(
                            "Restaurante Fechado 🌙",
                            `Nosso horário de funcionamento é a partir das ${settings.openTime}. Fique à vontade para montar o seu carrinho! Seu pedido ficará agendado e será preparado assim que abrirmos.`,
                            "alert",
                            "fa-solid fa-clock"
                        );
                    }
                    hasShownClosedAlert.current = true;
                }
            }, [loading, settings.openTime, settings.closeTime]);
            
            const showToast = (msg) => { 
                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                setToast(null); setTimeout(() => { setToast(msg); toastTimeoutRef.current = setTimeout(() => setToast(null), 3000); }, 50);
            };

            useEffect(() => { localStorage.setItem('fritzza_cart', JSON.stringify(cart)); }, [cart]);

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
                const interval = setInterval(reportPresence, 30000); // Avisa a cada 30s

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

            // AQUI ESTÁ A NOSSA LÓGICA DE LOADING CORRIGIDA
            useEffect(() => {
                const init = async () => {
                    if (!auth.currentUser) await auth.signInAnonymously();
                    const root = db.collection('artifacts').doc(APP_ID).collection('public').doc('data');
                    
                    const urlParams = new URLSearchParams(window.location.search);
                    const orderParam = urlParams.get('order');
                    if (orderParam) {
                        setActiveOrder(orderParam);
                        setView("status");
                        setLoading(false);
                        return;
                    }

                    let configLoaded = false;
                    let categoriesLoaded = false;
                    let productsLoaded = false;

                    const checkLoading = () => {
                        if (configLoaded && categoriesLoaded && productsLoaded) {
                            setLoading(false);
                        }
                    };

                    root.collection('config').doc('main').onSnapshot(d => { 
                        if (d.exists) { 
                            const data = d.data();
                            setSettings(prev => ({...prev, ...data})); 
                            if(data.bgColor) document.body.style.backgroundColor = data.bgColor; 
                        }
                        configLoaded = true;
                        checkLoading();
                    });
                    
                    root.collection('categories').orderBy('order').onSnapshot(s => {
                        setCategories(s.docs.map(d => ({ id: d.id, ...d.data() })));
                        categoriesLoaded = true;
                        checkLoading();
                    });
                    
                    root.collection('products').onSnapshot(s => {
                        setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
                        productsLoaded = true;
                        checkLoading();
                    });
                    
                    root.collection('neighborhoods').onSnapshot(s => setNeighborhoods(s.docs.map(d => ({ id: d.id, ...d.data() }))));
                };
                init();
            }, []);

            const addToCart = (p, e) => {
                showToast(`${p.name} adicionado!`);
                const performUpdate = () => {
                    setCart(prev => {
                        const exists = prev.find(i => i.id === p.id);
                        if (exists) return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
                        return [...prev, { ...p, quantity: 1 }];
                    });
                };

                if(e) {
                    setBagAnim(true);
                    setTimeout(() => setBagAnim(false), 600);
                    const card = e.currentTarget.closest('.product-card');
                    const img = card ? card.querySelector('img') : null;
                    const rect = img ? img.getBoundingClientRect() : card.getBoundingClientRect();
                    const clone = img ? img.cloneNode(true) : document.createElement('div');
                    if(!img) { clone.style.backgroundColor = settings.themeColor; clone.style.borderRadius = '50%'; }
                    clone.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:10000;border-radius:50%;pointer-events:none;transition:all 0.5s cubic-bezier(0.5,0.05,0.5,0.95);box-shadow:0 10px 25px rgba(0,0,0,0.3);object-fit:cover;`;
                    clone.className = 'flying-img';
                    document.body.appendChild(clone);

                    const bagElement = document.querySelector('.bag-container');
                    let destX, destY;
                    if(bagElement) {
                        const dest = bagElement.getBoundingClientRect();
                        destX = dest.left + (dest.width / 2) - 15; destY = dest.top - 10;
                    } else {
                        destX = window.innerWidth / 2 - 15; destY = window.innerHeight - 90; 
                    }
                    clone.getBoundingClientRect();
                    setTimeout(() => { clone.style.left = destX + 'px'; clone.style.top = destY + 'px'; clone.style.width = '30px'; clone.style.height = '30px'; clone.style.transform = 'scale(0.8)'; }, 10);
                    setTimeout(() => { clone.style.opacity = '0'; clone.style.transform = 'scale(0.2) translateY(10px)'; performUpdate(); setTimeout(() => clone.remove(), 100); }, 500);
                } else { performUpdate(); }
            };

            const themeStyle = { backgroundColor: settings.themeColor || '#dc2626' };
            const borderStyle = settings.borderRadius || 'rounded-2xl'; 

            if (loading) return <div className="h-screen flex flex-col items-center justify-center text-gray-400 bg-gray-50"><div className="loader border-gray-400 border-b-transparent mb-4"></div><p>Carregando...</p></div>;

            return (
                <div className="min-h-screen pb-24 relative overflow-hidden">
                    <GlobalModal modal={modal} close={closeModal} />
                    <Toast msg={toast} />
                    
                    {/* Header Responsivo */}
                    <header className="sticky top-0 z-40 transition-all duration-300 md:pt-4">
                        <div className={`relative overflow-hidden pt-4 pb-12 px-4 shadow-lg mx-auto md:max-w-7xl ${settings.borderRadius === 'rounded-none' ? '' : 'rounded-b-[2rem] md:rounded-[2rem]'}`} style={themeStyle}>
                            {settings.bannerUrl ? <div className="absolute inset-0 z-0"><img src={settings.bannerUrl} className="w-full h-full object-cover opacity-50" /></div> : <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/food.png')]"></div>}
                            <div className="relative z-10 flex justify-between items-center md:px-8">
							<div className="flex items-center text-white">
								<img 
									src={settings.logoUrl || "https://i.imgur.com/DvATbsT.png"} 
									alt="Fritzza" 
									className="h-[72px] w-auto object-contain drop-shadow-md" 
								/>
							</div>
							<div className="flex flex-col items-end gap-2">
								<a href="https://wa.me/5545998059550" target="_blank" className="text-white text-xs md:text-sm font-bold flex items-center gap-1.5 drop-shadow-md hover:text-green-300 transition-colors bg-black/20 px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
									<i className="fa-brands fa-whatsapp text-[#25D366] text-base md:text-lg"></i> (45) 99805-9550
								</a>
								<button onClick={()=>window.location.href='acompanhar.html'} className="bg-white/20 backdrop-blur text-white px-4 py-2 rounded-full text-sm font-bold border border-white/30 hover:bg-white/30 transition shadow-sm">
									<i className="fa-solid fa-motorcycle mr-2"></i> Pedidos
								</button>
							</div>
						</div>
                            {settings.headerPhrase && <div className="relative z-10 mt-3 text-center"><div className="inline-block bg-black/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs md:text-sm text-white font-medium border border-white/10 shadow-sm"><i className="fa-solid fa-bullhorn mr-2 text-yellow-300"></i> {settings.headerPhrase}</div></div>}
                        </div>
                    </header>

                    {/* Ajuste do Container Principal para max-w-7xl no Desktop */}
                    <main className={`container mx-auto max-w-7xl ${view === 'menu' ? '-mt-8' : ''} relative z-20 px-4 md:px-8`}>
                        {view === "menu" && <MenuView products={products} categories={categories} addToCart={addToCart} settings={settings} theme={themeStyle} border={borderStyle} />}
                        {view === "checkout" && <CheckoutView cart={cart} setCart={setCart} settings={settings} neighborhoods={neighborhoods} products={products} onBack={()=>setView("menu")} showAlert={showAlert} showConfirm={showConfirm} showLoading={showLoading} closeModal={closeModal} theme={themeStyle} border={borderStyle} />}
                    </main>

                    {/* Botão Flutuante do Carrinho - Reposicionado no Desktop */}
                    {view === "menu" && cart.length > 0 && (
                        <div className="fixed bottom-6 left-0 right-0 px-4 z-50 flex justify-center md:justify-end md:px-12 pointer-events-none">
                            <button id="cart-fab-btn" onClick={()=>setView("checkout")} className={`pointer-events-auto w-full max-w-lg md:max-w-sm p-4 shadow-2xl flex items-center justify-between transform transition hover:scale-[1.02] active:scale-95 text-white ${borderStyle}`} style={{backgroundColor: settings.cartColor || '#16a34a'}}>
                                <div className="flex items-center gap-4">
                                    <MagicBag count={cart.reduce((a,b)=>a+b.quantity,0)} isAnimating={bagAnim} color={settings.cartColor ? '#15803d' : '#16a34a'} />
                                    <div className="text-left border-l border-white/20 pl-4">
                                        <div className="text-sm opacity-90 font-medium">Meu Carrinho</div>
                                        <div className="font-bold text-xl leading-none">{formatMoney(cart.reduce((a,b)=>a+(b.price*b.quantity),0))}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 font-bold text-sm bg-black/20 px-4 py-2 rounded-xl">Ver <i className="fa-solid fa-arrow-right"></i></div>
                            </button>
                        </div>
                    )}

                    {/* Botão Flutuante do WhatsApp */}
                    <a href="https://wa.me/5545998059550" target="_blank" rel="noopener noreferrer" className={`fixed right-4 md:right-8 z-[60] bg-[#25D366] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(37,211,102,0.4)] hover:bg-[#1ebe57] hover:scale-110 active:scale-95 transition-all duration-300 group ${view === 'menu' && cart.length > 0 ? 'bottom-28 md:bottom-32' : 'bottom-6 md:bottom-8'}`}>
                        <span className="absolute right-16 bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Falar conosco
                        </span>
                        <i className="fa-brands fa-whatsapp text-3xl"></i>
                    </a>

                </div>
            );
        };

        const MenuView = ({ products, categories, addToCart, settings, theme, border }) => {
            const [search, setSearch] = useState("");
            const [catSel, setCatSel] = useState("Todas");
            const isOpen = isStoreOpen(settings.openTime, settings.closeTime);
            
            const filteredProducts = useMemo(() => {
                let list = products;
                if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase()));
                if (catSel !== "Todas") list = list.filter(p => p.category === catSel);
                return list;
            }, [products, search, catSel]);

            return (
                <div className="pb-10">
                    <div className={`mt-8 bg-white shadow-lg p-5 mb-8 glass-panel md:max-w-2xl md:mx-auto ${border}`}>
                        <div className={`flex items-center justify-center gap-2 text-sm font-bold mb-4 ${isOpen ? 'text-green-600' : 'text-red-500'}`}>
                            <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                            {isOpen ? "Aberto agora - Faça seu pedido!" : `Fechado • Abre às ${settings.openTime}`}
                        </div>
                        
                        <div className="relative">
                            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <input type="text" placeholder="Buscar no cardápio..." className={`w-full bg-gray-100 border-none py-3.5 pl-11 pr-4 text-gray-700 focus:ring-2 focus:ring-opacity-50 outline-none transition ${border}`} style={{'--tw-ring-color': settings.themeColor}} value={search} onChange={e=>setSearch(e.target.value)} />
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto md:flex-wrap md:justify-center pb-4 hide-scrollbar mb-6 sticky top-[88px] z-30 py-3 -mx-4 px-4 md:mx-0 md:px-0 bg-gradient-to-b from-[#f8fafc] md:bg-white/80 md:backdrop-blur-md to-transparent md:rounded-2xl">
                        <button onClick={()=>setCatSel("Todas")} className={`px-5 py-2.5 text-sm font-bold whitespace-nowrap transition shadow-sm ${catSel==="Todas" ? 'text-white shadow-md transform scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'} ${border}`} style={catSel==="Todas"?theme:{}}>Todas</button>
                        {categories.map(c => (<button key={c.id} onClick={()=>setCatSel(c.name)} className={`px-5 py-2.5 text-sm font-bold whitespace-nowrap transition shadow-sm ${catSel===c.name ? 'text-white shadow-md transform scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'} ${border}`} style={catSel===c.name?theme:{}}>{c.name}</button>))}
                    </div>

                    <div className={`space-y-8 md:space-y-10`}>
                        {filteredProducts.length === 0 ? <div className="text-center py-10 opacity-50"><p>Nenhum produto encontrado.</p></div> : 
                        catSel === "Todas" && !search ? categories.map(cat => {
                            const prods = filteredProducts.filter(p => p.category === cat.name);
                            if(prods.length === 0) return null;
                            // Alteração Mágica para o Grid Responsivo
                            return <div key={cat.id}><h2 className="font-bold text-xl md:text-2xl text-gray-800 mb-5 flex items-center gap-3"><span className="w-1.5 h-6 md:h-8 rounded-full shadow-sm" style={theme}></span> {cat.name}</h2><div className={`grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`}>{prods.map(p => <ProductCard key={p.id} p={p} addToCart={addToCart} theme={theme} border={border} styleType={settings.cardStyle} />)}</div></div>;
                        }) : <div className={`grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`}>{filteredProducts.map(p => <ProductCard key={p.id} p={p} addToCart={addToCart} theme={theme} border={border} styleType={settings.cardStyle} />)}</div>}
                    </div>
                </div>
            );
        };

        const ProductCard = ({ p, addToCart, theme, border, styleType }) => {
            // Regra de exclusão: Bebidas e Combos não recebem a tag (Promos mostram normalmente)
            const catLower = (p.category || "").toLowerCase();
            const isExcludedCategory = catLower.includes('bebida') || catLower.includes('combo');
            
            // Lógica do desconto
            const ifoodPrice = parseFloat(p.ifoodPrice);
            const currentPrice = parseFloat(p.price);
            const hasPromo = ifoodPrice > currentPrice && !isExcludedCategory;
            const discountPercent = hasPromo ? Math.round(((ifoodPrice - currentPrice) / ifoodPrice) * 100) : 0;

            return (
                <div className={`bg-white p-4 shadow-sm border border-gray-100 flex gap-4 overflow-hidden relative group hover:shadow-lg transition-all duration-300 ${border} product-card cursor-pointer`} onClick={(e) => { if(!e.target.closest('button')) addToCart(p, e); }}>
                    {hasPromo && (
                        <div className="absolute top-0 right-0 bg-red-600 text-white text-[10.5px] font-bold px-2 py-1 rounded-bl-xl z-10 shadow-sm flex items-center gap-1">
                            <i className="fa-solid fa-tag"></i> -{discountPercent}% OFF
                        </div>
                    )}
                    <div className={`w-28 h-28 md:w-32 md:h-32 bg-gray-50 flex-shrink-0 relative overflow-hidden ${border}`}>
                        {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover transition duration-500 group-hover:scale-110" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><i className="fa-solid fa-utensils text-2xl"></i></div>}
                    </div>
                    <div className="flex-1 flex flex-col py-1">
                        <div>
                            <h3 className="font-bold text-gray-800 leading-tight mb-2 pr-12 md:text-lg group-hover:text-blue-600 transition-colors">{p.name}</h3>
                            {/* Removemos o limite de linhas e adicionamos whitespace-pre-line para respeitar os "Enters" */}
                            <p className="text-xs md:text-sm text-gray-500 leading-relaxed whitespace-pre-line mb-3">{p.description}</p>
                        </div>
                        {/* mt-auto garante que o preço e o botão de adicionar fiquem sempre alinhados no fundo */}
                        <div className="flex justify-between items-end mt-auto">
                            <div className="flex flex-col">
                                {hasPromo && (
                                    <span className="text-[11px] text-gray-400 line-through leading-none mb-1">iFood: {formatMoney(ifoodPrice)}</span>
                                )}
                                <span className="font-bold text-lg md:text-xl text-green-600 leading-none">{formatMoney(currentPrice)}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); addToCart(p, e); }} className="w-9 h-9 md:w-10 md:h-10 rounded-full text-white shadow-md flex items-center justify-center hover:scale-110 active:scale-90 transition" style={theme}><i className="fa-solid fa-plus"></i></button>
                        </div>
                    </div>
                </div>
            );
        };

        const CheckoutView = ({ cart, setCart, settings, neighborhoods, products, onBack, showAlert, showConfirm, showLoading, closeModal, theme, border }) => {
            const [form, setForm] = useState({ name: "", phone: "", cep: "", address: "", number: "", bairro: "", complement: "", cpf: "" });
            const [del, setDel] = useState({ fee: 0, km: 0, loading: false, lat: null, lon: null, method: 'pendente' });
            const [payMethod, setPayMethod] = useState(""); const [change, setChange] = useState(""); const [couponCode, setCouponCode] = useState(""); const [appliedCoupon, setAppliedCoupon] = useState(null); const [typingTimer, setTypingTimer] = useState(null); const [cepLoading, setCepLoading] = useState(false); 
            const [pixData, setPixData] = useState(null);
            const [pixPaymentId, setPixPaymentId] = useState(null); 
            const [pixStatus, setPixStatus] = useState(null);       
            const totalItems = cart.reduce((a,b)=>a+(b.price*b.quantity),0);
            
            const handlePhoneChange = (e) => { let v = e.target.value.replace(/\D/g,'').slice(0,11); setForm(p => ({...p, phone: v})); if(v.length === 11) check(v); };
            const check = async (phoneValue) => { const clean = (phoneValue || form.phone).replace(/\D/g, ''); if(clean.length < 8) return; try { const snap = await getCol('customers').where('phoneRaw','==',clean).limit(1).get(); if(!snap.empty) { const d = snap.docs[0].data(); setForm(p => ({ ...p, name: d.name || "", cep: d.cep || "", number: d.number || "", complement: d.complement || "", address: d.address || "", bairro: d.bairro || "" })); if(d.cep) fetchCep(d.cep, false); } } catch(e) {} };
            const handleCepChange = (e) => { let val = e.target.value.replace(/\D/g, ''); if (val.length > 8) val = val.slice(0, 8); setForm(p => ({ ...p, cep: val })); if (val.length === 8) fetchCep(val, true); };
            const fetchCep = async (cep, autoFocusNumber) => { setCepLoading(true); try { const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`); const data = await res.json(); if(!data.erro) { if(data.localidade !== 'Cascavel') { showAlert("Atenção", "Entrega apenas em Cascavel/PR", "error"); return; } setForm(p=>({...p, address: data.logradouro, bairro: data.bairro})); if (autoFocusNumber && document.getElementById('input-number')) document.getElementById('input-number').focus(); } else { showAlert("Erro", "CEP não encontrado.", "error"); } } catch(e) { showAlert("Erro", "Erro ao buscar CEP.", "error"); } finally { setCepLoading(false); } };
            useEffect(() => { if (form.cep.length >= 8 && form.number && form.bairro && form.address) { setDel(p => ({ ...p, loading: true })); if (typingTimer) clearTimeout(typingTimer); const timer = setTimeout(() => calculateFinalShipping(), 1000); setTypingTimer(timer); } }, [form.number, form.cep, form.bairro, form.address]);
            const calculateFinalShipping = async () => { if(!form.bairro) return; const bairroMatch = neighborhoods.find(n => n.name.toLowerCase().trim() === form.bairro.toLowerCase().trim()); if (bairroMatch) { setDel({ fee: parseFloat(bairroMatch.price), method: 'bairro_fixo' }); return; } try { const query = `${form.address}, ${form.number}, Cascavel, PR, Brazil`; const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`); const data = await res.json(); if(data.length > 0) { const lat = parseFloat(data[0].lat); const lon = parseFloat(data[0].lon); const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${settings.restLng},${settings.restLat};${lon},${lat}?overview=false`; const rRes = await fetch(osrmUrl); const rData = await rRes.json(); if (rData.routes && rData.routes.length > 0) { const km = (rData.routes[0].distance / 1000).toFixed(1); const fee = Math.max(5, km * settings.pricePerKm); setDel({ fee, km, lat, lon, method: 'gps_auto' }); } else { fallbackCalc(lat, lon); } } else { setDel({ fee: 0, method: 'erro' }); showAlert("Atenção", "Rota não encontrada. Verifique o número.", 'alert'); } } catch(e) { setDel({ fee: 0, method: 'erro' }); } };
            const fallbackCalc = (lat, lon) => { const R=6371; const dLat=(lat-settings.restLat)*Math.PI/180; const dLon=(lon-settings.restLng)*Math.PI/180; const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(settings.restLat*Math.PI/180)*Math.cos(lat*Math.PI/180) * Math.sin(dLon/2)*Math.sin(dLon/2); const km = (R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)) * 1.3).toFixed(1); const fee = Math.max(5, km * settings.pricePerKm); setDel({ fee, km, lat, lon, method: 'fallback' }); };
            const handleCouponChange = (e) => { setCouponCode(e.target.value.replace(/\s/g, '').toUpperCase()); };
            const applyCoupon = async () => { 
    if(!couponCode) return; 
    const q = await getCol('coupons').where('code', '==', couponCode.toUpperCase()).where('active', '==', true).get(); 
    if(q.empty) return showAlert("Erro", "Cupom inválido", "error"); 
    const d = q.docs[0].data(); 
    if(d.limit && (d.usageCount || 0) >= d.limit) return showAlert("Erro", "Cupom esgotado", "error"); 
    
    setAppliedCoupon({ id: q.docs[0].id, ...d }); 
    
    // VERIFICA SE JÁ HAVIA PAGAMENTO SELECIONADO
    if (payMethod) {
        setPayMethod(""); // Limpa a seleção de pagamento
        setPixData(null); // Limpa o QR Code antigo
        setPixPaymentId(null); // Limpa o ID do Pix antigo
        setPixStatus(null); // Limpa o status
        setChange(""); // Limpa o troco (caso fosse dinheiro)
        
        showAlert("Sucesso 🎉", "Cupom aplicado! Como o valor mudou, por favor, selecione sua forma de pagamento novamente.", "success");
    } else {
        showAlert("Sucesso", "Cupom aplicado!", "success"); 
    }
};
            const getDiscount = () => { 
    if(!appliedCoupon) return 0; 
    if(appliedCoupon.type === 'fixed') return parseFloat(appliedCoupon.value); 
    if(appliedCoupon.type === 'percent') { 
        const d = totalItems * (parseFloat(appliedCoupon.value)/100); 
        return appliedCoupon.maxDiscount ? Math.min(d, parseFloat(appliedCoupon.maxDiscount)) : d; 
    } 
    if(appliedCoupon.type === 'shipping') return del.fee; // Adicionamos esta regra para o frete grátis!
    return 0; 
};
            const discount = getDiscount(); const total = Math.max(0, totalItems + del.fee - discount);
            
            // --- NOVA FUNÇÃO HANDLE PIX APONTANDO PRO SEU RENDER ---
            // --- NOVA FUNÇÃO HANDLE PIX ---
            const handlePix = async () => { 
                if (!form.name || !form.phone || !form.cep || !form.number) { 
                    showAlert("Atenção", "Preencha todos os dados de entrega antes de gerar o Pix.", "alert"); 
                    return; 
                } 

                const executePix = async () => {
                    showLoading("Gerando Pix..."); 
                    try { 
                        const randomEmail = `cliente_${Date.now()}@fritzza.online`;
                        const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36).substring(2);
                        const orderRef = `PEDIDO-${Date.now()}`;

                        const mpItems = cart.map(item => ({
                            id: item.id || "item_padrao",
                            title: item.name.substring(0, 256),
                            description: (item.description || "Produto Fritzza").substring(0, 256),
                            category_id: "food",
                            quantity: item.quantity,
                            unit_price: Number(item.price)
                        }));

                        const payload = { 
                            transaction_amount: Number(total.toFixed(2)), 
                            description: `Pedido ${settings.appName} - ${form.phone}`, 
                            payment_method_id: "pix",
                            external_reference: orderRef, 
                            notification_url: "https://rodaa.onrender.com/api/webhook", 
                            statement_descriptor: "FRITZZA", 
                            additional_info: {
                                items: mpItems,
                                payer: {
                                    first_name: form.name.split(' ')[0],
                                    last_name: form.name.split(' ').slice(1).join(' ') || 'Cliente',
                                    phone: { area_code: form.phone.substring(0, 2), number: form.phone.substring(2) },
                                    address: { zip_code: form.cep.replace(/\D/g, ''), street_name: form.address, street_number: form.number }
                                }
                            },
                            payer: { email: randomEmail, first_name: form.name.split(' ')[0], last_name: form.name.split(' ').slice(1).join(' ') || 'Cliente' }
                        }; 

                        if (form.cpf && form.cpf.length === 11) {
                            payload.payer.identification = { type: "CPF", number: form.cpf };
                        }

                        const res = await fetch("https://rodaa.onrender.com/api/pix", { 
                            method: "POST", 
                            headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey }, 
                            body: JSON.stringify(payload) 
                        }); 
                        
                        if (res.ok) { 
                            const data = await res.json(); 
                            if (data.point_of_interaction) { 
                                setPixData(data); 
                                setPixPaymentId(data.id); 
                                setPixStatus("pending"); 
                                closeModal(); 
                            } else { throw new Error("Falha no Mercado Pago."); }
                        } else { throw new Error("Falha no servidor Render."); } 
                    } catch (e) { 
                        closeModal(); 
                        showAlert("Erro", "Sistema de Pix indisponível no momento.", "error"); 
                    }
                };

                // Verifica se está fechado e exibe a confirmação
                if (!isStoreOpen(settings.openTime, settings.closeTime)) {
                    showConfirm(
                        "Agendar Pedido com Pix? ⏰",
                        `Estamos fechados e abriremos às ${settings.openTime}. Seu pedido será agendado para preparo. Deseja gerar o Pix e confirmar o agendamento?`,
                        executePix
                    );
                } else {
                    executePix();
                }
            };
            
            // --- NOVO POLLING VERIFICANDO O STATUS PELO SEU RENDER ---
            useEffect(() => { 
                let interval; 
                if (pixPaymentId && pixStatus !== 'approved') { 
                    interval = setInterval(async () => { 
                        try { 
                            const res = await fetch(`https://rodaa.onrender.com/api/pix/${pixPaymentId}`); 
                            if(res.ok) {
                                const data = await res.json(); 
                                if (data.status === 'approved') { setPixStatus('approved'); clearInterval(interval); } 
                            }
                        } catch(e) {} 
                    }, 5000); 
                } 
                return () => clearInterval(interval); 
            }, [pixPaymentId, pixStatus]);

            useEffect(() => { if (pixStatus === 'approved') { showAlert("Pix Aprovado! 🎉", "Recebemos seu pagamento. Finalizando o pedido...", "success"); setTimeout(() => { finishOrder(true); }, 2000); } }, [pixStatus]);
            
            const finishOrder = async (skipCheck = false) => {
                if(!form.name || !form.phone || !form.address || !form.number) return showAlert("Ops", "Preencha todos os campos de entrega.");
                if(!payMethod) return showAlert("Ops", "Selecione o pagamento.");
                if(del.fee === 0 && del.method !== 'bairro_fixo') return showAlert("Atenção", "Aguardando cálculo do frete...", "alert");
                
                const executeOrder = async () => {
                    showLoading("Finalizando...");
                    try {
                        const cleanPhone = form.phone.replace(/\D/g,'');
                        const ref = await getCol('orders').add({ customer: form, items: cart, totals: { sub: totalItems, del: del.fee, discount, total: total }, payment: { method: payMethod, change: change }, coupon: appliedCoupon ? appliedCoupon.code : null, createdAt: new Date().toISOString(), status: 'pendente' });
                        if(appliedCoupon) getCol('coupons').doc(appliedCoupon.id).update({ usageCount: firebase.firestore.FieldValue.increment(1) });
                        const cRef = getCol('customers'); const cSnap = await cRef.where('phoneRaw', '==', cleanPhone).limit(1).get();
                        if(cSnap.empty) cRef.add({ ...form, phoneRaw: cleanPhone, lastOrder: new Date().toISOString(), orderCount: 1 }); else cSnap.docs[0].ref.update({ ...form, lastOrder: new Date().toISOString(), orderCount: firebase.firestore.FieldValue.increment(1) });
                        
                        if(settings.whatsappServerUrl) {
                            try {
                                const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/')) + '/';
                                const trackLink = `${baseUrl}acompanhar.html?fone=${cleanPhone}`;
                                const plainMsg = formatTunnelMessage(settings.whatsappTemplate, form, cart, { sub: totalItems, del: del.fee, discount, total }, { method: payMethod, change, coupon: appliedCoupon?.code }, trackLink, settings.appName);
                                let finalPhone = cleanPhone; if(finalPhone.length >= 10 && finalPhone.length <= 11) finalPhone = '55' + finalPhone;
                                await fetch(settings.whatsappServerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: finalPhone, message: plainMsg }) });
                            } catch(err) { console.error("Erro ao tentar enviar WhatsApp automático:", err); }
                        }
                        
                        localStorage.setItem('fritzza_last_order', ref.id); localStorage.setItem('fritzza_last_order_date', new Date().toISOString()); localStorage.setItem('fritzza_last_phone', cleanPhone);
                        closeModal(); setCart([]); 
                        window.location.href = `acompanhar.html?fone=${cleanPhone}`;
                    } catch(e) { closeModal(); showAlert("Erro", "Erro ao enviar: " + e.message); }
                };

                // Verifica se está fechado e se não deve pular a checagem (ex: Pix já pago)
                if (skipCheck !== true && !isStoreOpen(settings.openTime, settings.closeTime)) {
                    showConfirm(
                        "Agendar Pedido? ⏰",
                        `Estamos fechados e abriremos às ${settings.openTime}. Seu pedido será agendado para preparo assim que abrirmos. Deseja confirmar?`,
                        executeOrder
                    );
                } else {
                    executeOrder();
                }
            };
            const copyPix = () => { if(pixData?.point_of_interaction?.transaction_data?.qr_code) { navigator.clipboard.writeText(pixData.point_of_interaction.transaction_data.qr_code); showAlert("Sucesso", "Código Pix copiado!", "success"); } };

            return (
                <div className="pt-8">
                    <button onClick={onBack} className="mb-6 text-gray-500 hover:text-gray-800 transition font-bold flex items-center gap-2 text-sm"><i className="fa-solid fa-arrow-left"></i> Voltar ao Cardápio</button>
                    
                    <div className={`bg-white shadow-xl overflow-hidden ${border} grid grid-cols-1 md:grid-cols-12 md:items-start`}>
                        
                        {/* 1. DADOS DE ENTREGA */}
                        <div className="p-6 md:p-8 md:pb-4 md:col-span-7 order-1 space-y-4">
                            <h3 className="font-bold text-lg md:text-xl text-gray-800 border-l-4 pl-3 flex items-center gap-2" style={{borderColor: settings.themeColor}}>
                                <i className="fa-solid fa-location-dot text-gray-400"></i> Dados de Entrega
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input type="tel" placeholder="WhatsApp (45...)" className={`border p-3.5 bg-gray-50 w-full text-base font-medium focus:ring-2 focus:ring-opacity-50 outline-none transition ${border}`} style={{'--tw-ring-color': settings.themeColor}} value={form.phone} onChange={handlePhoneChange} onBlur={()=>check(form.phone)} />
                                <input placeholder="Seu Nome" className={`border p-3.5 bg-gray-50 w-full text-base font-medium focus:ring-2 focus:ring-opacity-50 outline-none transition ${border}`} style={{'--tw-ring-color': settings.themeColor}} value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                                <div className="relative col-span-2">
                                    <input type="tel" placeholder="CEP (Apenas Números)" className={`border p-3.5 bg-gray-50 w-full font-medium focus:ring-2 focus:ring-opacity-50 outline-none transition ${border}`} style={{'--tw-ring-color': settings.themeColor}} value={form.cep} onChange={handleCepChange} maxLength={9} />
                                    {cepLoading && <i className="fa-solid fa-spinner fa-spin absolute right-4 top-4 text-gray-400"></i>}
                                </div>
                                <input placeholder="Nº da Casa" type="tel" id="input-number" className={`border p-3.5 bg-gray-50 w-full text-center font-bold focus:ring-2 focus:ring-opacity-50 outline-none transition ${border}`} style={{'--tw-ring-color': settings.themeColor}} value={form.number} onChange={e=>setForm({...form, number:e.target.value})} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input placeholder="Endereço (Puxado pelo CEP)" className={`border p-3.5 bg-gray-100 text-gray-500 w-full ${border}`} value={form.address} readOnly />
                                <input placeholder="Bairro" className={`border p-3.5 bg-gray-100 text-gray-500 w-full ${border}`} value={form.bairro} readOnly />
                            </div>
                            <input placeholder="Complemento / Ponto de Referência (Opcional)" className={`border p-3.5 bg-gray-50 w-full focus:ring-2 focus:ring-opacity-50 outline-none transition ${border}`} style={{'--tw-ring-color': settings.themeColor}} value={form.complement} onChange={e=>setForm({...form, complement:e.target.value})} />
                        </div>

                        {/* 2. RESUMO DO PEDIDO */}
                        <div className="bg-gray-50 p-6 border-y md:border-y-0 md:border-l md:col-span-5 md:row-span-2 md:sticky md:top-24 order-2">
                            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                <i className="fa-solid fa-receipt text-gray-400"></i> Resumo do Pedido
                            </h2>
                            <div className="mt-4 space-y-4 max-h-48 md:max-h-[35vh] overflow-y-auto pr-2 custom-scroll">
                                {cart.map(i => (
                                    <div key={i.id} className="flex justify-between items-center text-sm md:text-base bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-gray-800 text-white w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs">{i.quantity}</span>
                                            <span className="text-gray-700 font-medium">{i.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-gray-800">{formatMoney(i.price * i.quantity)}</span>
                                            <button onClick={()=>setCart(p=>p.filter(x=>x.id!==i.id))} className="text-red-400 hover:text-red-600 transition w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50"><i className="fa-solid fa-trash"></i></button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2 text-sm md:text-base">
                                <div className="flex justify-between text-gray-500 font-medium"><span>Subtotal</span><span>{formatMoney(totalItems)}</span></div>
                                <div className="flex justify-between text-gray-500 font-medium"><span>Entrega {del.km > 0 ? `(${del.km}km)` : ''}</span><span className="text-gray-800">{del.loading ? 'Calculando...' : formatMoney(del.fee)}</span></div>
                                {discount > 0 && <div className="flex justify-between text-green-600 font-bold"><span>Desconto</span><span>- {formatMoney(discount)}</span></div>}
                                <div className="flex justify-between text-2xl font-black text-gray-800 border-t border-gray-100 pt-4 mt-4" style={{color: settings.themeColor}}>
                                    <span>Total</span><span>{formatMoney(total)}</span>
                                </div>
                            </div>
                            
                            <button onClick={finishOrder} disabled={del.loading || (del.fee===0 && del.method!=='bairro_fixo') || pixStatus === 'approved'} className={`hidden md:flex w-full py-4 mt-6 bg-green-600 hover:bg-green-700 text-white font-bold shadow-xl transition transform hover:-translate-y-1 active:scale-95 items-center justify-center gap-3 disabled:opacity-50 disabled:transform-none ${border}`} style={{backgroundColor: settings.cartColor}}>
                                <span className="text-lg">Finalizar Pedido</span><i className="fa-brands fa-whatsapp text-xl"></i>
                            </button>
                        </div>

                        {/* 3. PAGAMENTO */}
                        <div className="p-6 md:p-8 md:pt-4 md:col-span-7 order-3 space-y-4">
                            <h3 className="font-bold text-lg md:text-xl text-gray-800 border-l-4 pl-3 flex items-center gap-2 mt-2 md:mt-0" style={{borderColor: settings.themeColor}}>
                                <i className="fa-solid fa-wallet text-gray-400"></i> Pagamento
                            </h3>
                            
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <label className="text-xs font-bold text-gray-500 mb-2 block">TEM CUPOM DE DESCONTO?</label>
                                {/* CORREÇÃO DO CUPOM: min-w-0 no input e flex-shrink-0 no botão */}
                                <div className="flex gap-2">
                                    <input placeholder="Digite aqui..." className={`border p-3 flex-1 min-w-0 uppercase text-sm md:text-base font-bold tracking-wider outline-none focus:border-gray-400 ${border}`} value={couponCode} onChange={handleCouponChange} />
                                    <button onClick={applyCoupon} className={`px-4 md:px-6 text-white text-sm md:text-base font-bold whitespace-nowrap flex-shrink-0 hover:opacity-90 transition ${border}`} style={theme}>APLICAR</button>
                                </div>
                                {appliedCoupon && <div className="mt-3 bg-green-100 border border-green-200 text-green-700 p-3 text-sm font-bold rounded-lg flex justify-between items-center"><span className="flex items-center gap-2"><i className="fa-solid fa-tag"></i> {appliedCoupon.code}</span><span>- {formatMoney(discount)}</span></div>}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-4">
                                {['Dinheiro', 'Pix'].map(m => (
                                    <button 
                                        key={m} 
                                        disabled={del.loading || (del.fee === 0 && del.method !== 'bairro_fixo')}
                                        onClick={() => { 
                                            if (m === 'Pix') {
                                                if (!form.name || !form.phone || !form.cep || !form.number) {
                                                    showAlert("Atenção", "Preencha os dados de entrega antes de selecionar o Pix.", "alert");
                                                    return;
                                                }
                                                setPayMethod(m); 
                                                setPixData(null); 
                                                setTimeout(() => handlePix(), 50);
                                            } else {
                                                setPayMethod(m); 
                                                setPixData(null); 
                                            }
                                        }} 
                                        className={`p-4 border md:text-base font-bold transition flex flex-col items-center justify-center gap-2 ${border} ${del.loading || (del.fee === 0 && del.method !== 'bairro_fixo') ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' : (payMethod === m ? 'bg-gray-800 text-white border-gray-800 shadow-md transform scale-[1.02]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300')}`} 
                                        style={payMethod === m && !(del.loading || (del.fee === 0 && del.method !== 'bairro_fixo')) ? theme : {}}
                                    >
                                        {/* CORREÇÃO DO ÍCONE PIX: fa-brands e cor oficial */}
                                        <i className={`${m === 'Dinheiro' ? 'fa-solid fa-money-bill-wave' : 'fa-brands fa-pix'} text-2xl ${payMethod === m ? 'text-white' : (m === 'Pix' ? 'text-[#32bcad]' : 'text-green-600')}`}></i>
                                        {m}
                                    </button>
                                ))}
                                <button 
                                    disabled={del.loading || (del.fee === 0 && del.method !== 'bairro_fixo')}
                                    onClick={() => { setPayMethod('Cartão Crédito/Débito'); setPixData(null); }} 
                                    className={`p-4 border md:text-base font-bold transition col-span-2 flex items-center justify-center gap-3 ${border} ${del.loading || (del.fee === 0 && del.method !== 'bairro_fixo') ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' : (payMethod === 'Cartão Crédito/Débito' ? 'bg-gray-800 text-white border-gray-800 shadow-md transform scale-[1.01]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300')}`} 
                                    style={payMethod === 'Cartão Crédito/Débito' && !(del.loading || (del.fee === 0 && del.method !== 'bairro_fixo')) ? theme : {}}
                                >
                                    <i className="fa-regular fa-credit-card text-xl"></i>
                                    Cartão (Levamos a maquininha)
                                </button>
                            </div>

                            {payMethod === 'Dinheiro' && (
                                <div className="animate-fadeIn mt-4">
                                    <label className="text-sm font-bold text-gray-600 mb-2 block">Precisa de troco para quanto?</label>
                                    <input type="number" placeholder="Ex: 50" className={`w-full p-4 border bg-yellow-50 text-lg font-bold focus:ring-2 outline-none transition ${border}`} style={{'--tw-ring-color': '#facc15', borderColor: '#fde047'}} value={change} onChange={e=>setChange(e.target.value)} />
                                </div>
                            )}
                            
                            {payMethod === 'Pix' && !pixData && (
                                <div className="animate-fadeIn mt-4 bg-gray-50 p-5 rounded-xl border border-gray-200 text-center">
                                    <p className="text-sm text-gray-600 mb-4 font-medium">Caso o código não tenha sido gerado automaticamente, tente novamente.</p>
                                    <button 
                                        onClick={handlePix} 
                                        className={`w-full py-3.5 text-white font-bold transition shadow-md hover:opacity-90 active:scale-95 flex items-center justify-center gap-2 ${border}`}
                                        style={theme}
                                    >
                                        <i className="fa-solid fa-rotate-right text-xl"></i> Tentar Novamente
                                    </button>
                                </div>
                            )}
                            
                            {pixData && (
                                <div className={`bg-teal-50 p-6 border border-teal-200 text-center shadow-inner mt-4 ${border}`}>
                                    <p className="font-bold text-teal-800 mb-4">Escaneie o QR Code ou copie o código</p>
                                    <div className="bg-white p-2 inline-block rounded-xl border shadow-sm mb-4">
                                        <img src={`data:image/png;base64,${pixData.point_of_interaction.transaction_data.qr_code_base64}`} className="w-48 h-48 mx-auto" alt="QR Code PIX" />
                                    </div>
                                    <textarea className="w-full text-xs p-3 border rounded-lg bg-white text-gray-600 outline-none focus:border-teal-400" rows="3" readOnly value={pixData.point_of_interaction.transaction_data.qr_code} onClick={(e)=>e.target.select()}></textarea>
                                    <button onClick={copyPix} className="w-full mt-3 py-3.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition shadow-md flex items-center justify-center gap-2 text-base"><i className="fa-regular fa-copy"></i> Copiar Código Pix</button>
                                </div>
                            )}

                            <button onClick={finishOrder} disabled={del.loading || (del.fee===0 && del.method!=='bairro_fixo') || pixStatus === 'approved'} className={`flex md:hidden w-full py-4 mt-8 bg-green-600 hover:bg-green-700 text-white font-bold shadow-xl transition transform hover:-translate-y-1 active:scale-95 items-center justify-center gap-3 disabled:opacity-50 disabled:transform-none ${border}`} style={{backgroundColor: settings.cartColor}}>
                                <span className="text-lg">Finalizar Pedido</span><i className="fa-brands fa-whatsapp text-xl"></i>
                            </button>

                        </div>
                    </div>
                </div>
            );
        };
        export default App;