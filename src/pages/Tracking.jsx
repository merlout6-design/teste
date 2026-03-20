import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';

const APP_ID = "rodaodef"; 
const getCol = (n) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection(n);

export default function Tracking() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [allOrders, setAllOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [phoneInput, setPhoneInput] = useState("");
    const [error, setError] = useState("");
    const [settings, setSettings] = useState({});

    const formatMoney = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    useEffect(() => {
        // Busca as configurações visuais (Cores, Logo, etc)
        const unsubConfig = db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('config').doc('main').onSnapshot(d => { 
            if (d.exists) { 
                setSettings(d.data()); 
                if(d.data().bgColor) document.body.style.backgroundColor = d.data().bgColor; 
            } 
        });

        const phone = searchParams.get('fone');
        if (phone) {
            loadOrders(phone);
        } else {
            setLoading(false);
        }

        return () => unsubConfig();
    }, [searchParams]);

    const loadOrders = (phone) => {
        setLoading(true);
        const cleanPhone = phone.replace(/\D/g, '');
        
        getCol('orders').where('customer.phone', '==', cleanPhone).limit(50).onSnapshot(snap => {
            if (snap.empty) { 
                setError("Nenhum pedido encontrado para este número."); 
                setLoading(false); 
                return; 
            }
            
            let orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // FILTRO: Apenas pedidos feitos HOJE
            const today = new Date();
            orders = orders.filter(o => {
                if(!o.createdAt) return false;
                const orderDate = new Date(o.createdAt);
                return orderDate.getDate() === today.getDate() &&
                       orderDate.getMonth() === today.getMonth() &&
                       orderDate.getFullYear() === today.getFullYear();
            });

            if (orders.length === 0) {
                setError("Você não tem pedidos registrados hoje.");
                setAllOrders([]);
                setSelectedOrder(null);
                setLoading(false);
                return;
            }

            orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setAllOrders(orders);
            setSelectedOrder(prev => { 
                if (prev) { 
                    const stillExists = orders.find(o => o.id === prev.id); 
                    return stillExists || orders[0]; 
                } 
                return orders[0]; 
            });
            setLoading(false);
        }, err => { 
            setError("Erro ao buscar pedidos."); 
            setLoading(false); 
        });
    };

    const handleSearch = (e) => { 
        e.preventDefault(); 
        if(phoneInput.length < 8) return; 
        const clean = phoneInput.replace(/\D/g,''); 
        setSearchParams({ fone: clean });
    };
    
    const themeStyle = { backgroundColor: settings.themeColor || '#dc2626' }; 
    const borderStyle = settings.borderRadius || 'rounded-2xl';
    
    if (loading) return <div className="h-screen flex flex-col items-center justify-center text-gray-400"><div className="loader border-gray-400 border-b-transparent mb-4"></div><p>Buscando pedidos...</p></div>;

    if (allOrders.length === 0 && !loading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className={`bg-white p-8 shadow-xl max-w-sm w-full text-center ${borderStyle}`}>
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl text-gray-400"><i className="fa-solid fa-search"></i></div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Meus Pedidos</h2>
                    <p className="text-sm text-gray-500 mb-6">Digite seu celular (WhatsApp) para listar os pedidos de hoje.</p>
                    <form onSubmit={handleSearch}>
                        <input type="tel" placeholder="Seu Celular (45...)" className={`w-full border p-3 bg-gray-50 text-center text-lg font-bold mb-4 focus:ring-2 focus:ring-opacity-50 outline-none transition ${borderStyle}`} style={{'--tw-ring-color': settings.themeColor}} value={phoneInput} onChange={e=>setPhoneInput(e.target.value)} autoFocus />
                        <button className={`w-full text-white py-3 font-bold shadow-lg hover:opacity-90 transition ${borderStyle}`} style={themeStyle}>Buscar</button>
                    </form>
                    {error && <div className="mt-4 text-red-500 text-sm bg-red-50 p-3 rounded font-medium">{error}</div>}
                    <Link to="/" className="block mt-6 text-sm text-gray-400 hover:text-gray-600 underline transition">Voltar para Cardápio</Link>
                </div>
            </div>
        );
    }

    if (!selectedOrder) return null;
    const steps = [ { s: 'pendente', label: 'Recebido', icon: 'fa-file-invoice' }, { s: 'confirmado', label: 'Confirmado', icon: 'fa-thumbs-up' }, { s: 'preparando', label: 'Preparando', icon: 'fa-fire-burner' }, { s: 'enviado', label: 'Saiu p/ Entrega', icon: 'fa-motorcycle' }, { s: 'entregue', label: 'Entregue', icon: 'fa-house-circle-check' } ];
    const currentIdx = steps.findIndex(st => st.s === selectedOrder.status) || 0;
    const progress = (currentIdx / (steps.length - 1)) * 100;
    const whatsNumber = settings.whatsappNumber || "5545988166885";

    return (
        <div className="min-h-screen pb-10 flex flex-col md:flex-row gap-6 max-w-6xl mx-auto p-4 md:p-8 animate-fade-in">
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-800 transition"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
                    <h2 className="text-xl font-bold text-gray-800">Acompanhamento</h2>
                </div>
                <div className={`bg-white shadow-xl overflow-hidden mb-6 relative ${borderStyle}`}>
                    <div className="p-8 text-center text-white relative overflow-hidden" style={themeStyle}>
                        <div className="absolute inset-0 bg-black/10"></div>
                        <div className="relative z-10">
                            <div className="text-sm opacity-80 mb-2">PEDIDO #{selectedOrder.id.slice(-4)}</div>
                            <h2 className="text-3xl font-chewy mb-2 animate-pulse">{steps[currentIdx].label}</h2>
                            <p className="text-sm opacity-90">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="p-8 bg-gray-50">
                        <div className="relative pl-8 space-y-8">
                            <div className="step-line absolute left-[15px] top-2 bottom-2 w-1 bg-gray-200"></div>
                            <div className="step-line absolute left-[15px] top-2 w-1 transition-all duration-1000" style={{height: `${progress}%`, ...themeStyle}}>
                                <div className="absolute -bottom-3 -left-3 bg-white p-1 rounded-full shadow-sm border moto-anim" style={{borderColor: settings.themeColor}}>
                                    <i className="fa-solid fa-motorcycle text-sm" style={{color: settings.themeColor}}></i>
                                </div>
                            </div>
                            {steps.map((st, i) => { 
                                const active = i <= currentIdx; 
                                return (
                                    <div key={st.s} className={`step-item flex items-center gap-4 ${active ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white z-10 shadow-md transition-all duration-500 ${active ? 'scale-110' : 'scale-100 bg-gray-300'}`} style={active ? themeStyle : {}}>
                                            <i className={`fa-solid ${st.icon} text-xs`}></i>
                                        </div>
                                        <div className="font-bold text-gray-800">{st.label}</div>
                                    </div>
                                ); 
                            })}
                        </div>
                    </div>
                    
                    <div className="p-6 border-t bg-white">
                        <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">Resumo do Pedido</h4>
                        <div className="text-sm text-gray-600 space-y-2 mb-4">
                            {selectedOrder.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between">
                                    <span><span className="font-bold text-gray-700 mr-1">{item.quantity}x</span> {item.name}</span>
                                    <span className="font-bold">{formatMoney(item.price * item.quantity)}</span>
                                </div>
                            ))}
                            <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
                                <div className="flex justify-between text-gray-500">
                                    <span>Subtotal</span>
                                    <span>{formatMoney(selectedOrder.totals.sub || 0)}</span>
                                </div>
                                <div className="flex justify-between text-gray-500">
                                    <span>Taxa de Entrega</span>
                                    <span>{formatMoney(selectedOrder.totals.del || 0)}</span>
                                </div>
                                {selectedOrder.totals.discount > 0 && (
                                    <div className="flex justify-between text-green-600 font-medium">
                                        <span>Desconto</span>
                                        <span>- {formatMoney(selectedOrder.totals.discount)}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between border-t border-gray-300 pt-3 mt-3 font-black text-xl text-gray-800" style={{color: settings.themeColor}}>
                                <span>Total</span>
                                <span>{formatMoney(selectedOrder.totals.total || 0)}</span>
                            </div>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 mb-4 flex items-start gap-2 border border-blue-100"><i className="fa-solid fa-location-dot mt-1 text-blue-500"></i><div><b>Entrega em:</b> {selectedOrder.customer.address}, {selectedOrder.customer.number} - {selectedOrder.customer.bairro}</div></div>
                        <button onClick={()=>window.location.href = `https://wa.me/${whatsNumber}`} className="w-full py-3.5 bg-green-500 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 hover:bg-green-600 active:scale-95 transition">
                            <i className="fa-brands fa-whatsapp text-lg"></i> Falar com o Restaurante
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="md:w-80 w-full">
                <h3 className="font-bold text-gray-800 mb-4 text-lg">Pedidos de Hoje ({allOrders.length})</h3>
                <div className="space-y-3">
                    {allOrders.map(order => (
                        <div key={order.id} onClick={() => { setSelectedOrder(order); window.scrollTo({top:0, behavior:'smooth'}); }} className={`p-4 rounded-xl cursor-pointer border transition hover:shadow-md order-card-enter ${selectedOrder.id === order.id ? 'bg-white border-l-4 shadow-md' : 'bg-white/60 border-transparent hover:bg-white'}`} style={selectedOrder.id === order.id ? {borderLeftColor: settings.themeColor} : {}}>
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-gray-800">#{order.id.slice(-4)}</span>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${order.status==='pendente'?'bg-red-100 text-red-700':order.status==='entregue'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{order.status}</span>
                            </div>
                            <div className="text-xs text-gray-500 mb-2">
                                <i className="fa-regular fa-clock mr-1"></i>Hoje às {new Date(order.createdAt).toLocaleTimeString().slice(0,5)}
                            </div>
                            <div className="flex justify-between items-end">
                                <span className="text-xs text-gray-600 font-medium">{order.items.length} itens</span>
                                <span className="font-bold text-gray-800">{formatMoney(order.totals.total || 0)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}