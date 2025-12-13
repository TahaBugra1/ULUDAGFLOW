
import React, { useState, useEffect, useMemo } from 'react';
import { api, BURSA_LOCATIONS, networkPredictionAPI, pipeBurstAPI } from './services/mockBackend';
import { User, Admin, Alert, Complaint, DashboardStats, RiskLevel } from './types';
import { PipeRiskDashboard } from './core/PipeRiskDashboard';
import { RiskListView } from './core/RiskListView';
import { TicketPage } from './core/TicketPage';

import AdminMapsView from './components/AdminMapsView';
import { BurstRiskMap } from './components/BurstRiskMap';
import RealNetworkMap from './components/RealNetworkMap';
import { 
  Droplet, 
  MapPin, 
  AlertTriangle, 
  Send, 
  LogOut, 
  BarChart3, 
  Radio, 
  Bell,
  CheckCircle2,
  ChevronLeft,
  User as UserIcon,
  Map as MapIcon,
  Users,
  ThumbsUp,
  MessageSquare,
  Trash2,
  Plus,
  Minus,
  RefreshCw,
  Lock,
  ArrowRight,
  UserPlus,
  LogIn,
  Edit2,
  X,
  Phone,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- Global State & Types ---
interface AppState {
    view: 'SPLASH' | 'RISK_DASHBOARD' | 'RISK_LIST' | 'TICKET_PAGE';
    currentUser: User | null;
    currentAdmin: Admin | null;
    ticketId?: string;
}

type TabView = 'ALERTS' | 'MAP' | 'SOCIAL';
type RiskSegment = '1-5' | '6-10' | '11-20' | '21+';
type RiskFilter = 'ALL' | RiskSegment;

// --- Shared Components ---

const LoadingSpinner = () => (
    <div className="flex flex-col items-center justify-center gap-3 p-8">
        <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-cyan-100"></div>
            <div className="absolute left-0 top-0 h-12 w-12 rounded-full border-4 border-transparent border-t-cyan-500 animate-spin"></div>
        </div>
        <p className="text-sm font-medium text-slate-500">Yükleniyor...</p>
    </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false, size = 'md' }: any) => {
    const base = 'flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50';
    const sizes = {
        sm: 'py-2.5 px-4 text-sm',
        md: 'py-3 px-5 text-sm',
        lg: 'py-4 px-6'
    } as const;
    const styles = {
        primary: 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/30 active:translate-y-0',
        secondary: 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/30',
        outline: 'bg-white text-slate-700 border-2 border-slate-200 hover:border-cyan-300 hover:text-cyan-600 hover:bg-cyan-50',
        danger: 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25 hover:shadow-xl',
        ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800'
    } as const;

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${base} ${sizes[size as keyof typeof sizes]} ${styles[variant as keyof typeof styles]} ${className}`}
        >
            {children}
        </button>
    );
};

const Input = ({ label, ...props }: any) => (
    <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
        <input
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            {...props}
        />
    </div>
);

const Select = ({ label, options, value, onChange, placeholder }: any) => (
    <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
        <div className="relative">
            <select
                className="w-full appearance-none rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition-all focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                value={value}
                onChange={onChange}
            >
                <option value="" className="text-slate-400">
                    {placeholder || 'Seçiniz'}
                </option>
                {options.map((opt: string) => (
                    <option key={opt} value={opt} className="text-slate-800">
                        {opt}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                <ChevronLeft className="h-4 w-4 -rotate-90 text-slate-500" />
            </div>
        </div>
    </div>
);

const Badge = ({ type }: { type: string }) => {
    const colors: Record<string, string> = {
        HIGH: 'bg-gradient-to-r from-red-500 to-rose-500 text-white',
        MEDIUM: 'bg-gradient-to-r from-amber-400 to-orange-400 text-white',
        LOW: 'bg-gradient-to-r from-blue-400 to-cyan-400 text-white',
        BASINC: 'bg-blue-100 text-blue-700 border border-blue-200',
        BASINC_DUSUK: 'bg-blue-100 text-blue-700 border border-blue-200',
        KALITE: 'bg-purple-100 text-purple-700 border border-purple-200',
        KESINTI: 'bg-red-100 text-red-700 border border-red-200',
        PATLAK: 'bg-rose-100 text-rose-700 border border-rose-200',
        SIZINTI: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
        SAYAC: 'bg-amber-100 text-amber-700 border border-amber-200',
        ALTYAPI: 'bg-amber-100 text-amber-700 border border-amber-200',
        FATURELENDIRME: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        DIGER: 'bg-slate-100 text-slate-600 border border-slate-200',
        RESOLVED: 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
    };

    const label = type === 'RESOLVED' ? 'ÇÖZÜLDÜ' : type.replace(/_/g, ' ');

    return (
        <span
            className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                colors[type] || colors.DIGER
            }`}
        >
            {label}
        </span>
    );
};

const getCategoryPillClass = (category: string) => {
    const normalized = category.toUpperCase();
    if (normalized === 'BASINC' || normalized === 'BASINC_DUSUK') return 'bg-blue-50 text-blue-700';
    if (normalized === 'KESINTI' || normalized === 'PATLAK') return 'bg-rose-50 text-rose-700';
    if (normalized === 'SIZINTI') return 'bg-cyan-50 text-cyan-700';
    if (normalized === 'KALITE') return 'bg-purple-50 text-purple-700';
    if (normalized === 'SAYAC') return 'bg-amber-50 text-amber-700';
    return 'bg-slate-100 text-slate-600';
};

const formatCategoryLabel = (category: string) => category.replace(/_/g, ' ');

const districtPositions: Record<string, { x: number; y: number }> = {
    Osmangazi: { x: 54, y: 53 },
    Nilüfer: { x: 36, y: 60 },
    Yıldırım: { x: 62, y: 50 },
    Mudanya: { x: 20, y: 46 },
    Gemlik: { x: 74, y: 32 },
    İnegöl: { x: 87, y: 58 },
    Kestel: { x: 70, y: 59 },
    Gürsu: { x: 66, y: 48 },
    Karacabey: { x: 15, y: 68 },
    Mustafakemalpaşa: { x: 12, y: 82 },
    Orhangazi: { x: 76, y: 36 },
    Orhaneli: { x: 42, y: 82 },
    Keles: { x: 45, y: 88 },
    Harmancık: { x: 50, y: 92 },
    Büyükorhan: { x: 30, y: 86 },
    İznik: { x: 82, y: 28 },
    Yenişehir: { x: 79, y: 40 }
};

const gradientByBand: Record<RiskSegment, string> = {
    '1-5': 'from-emerald-400 to-teal-500',
    '6-10': 'from-amber-400 to-orange-500',
    '11-20': 'from-rose-400 to-red-500',
    '21+': 'from-red-600 to-red-700'
};

const chipByBand: Record<RiskSegment, string> = {
    '1-5': 'border-emerald-200 bg-emerald-50 text-emerald-600',
    '6-10': 'border-amber-200 bg-amber-50 text-amber-600',
    '11-20': 'border-rose-200 bg-rose-50 text-rose-600',
    '21+': 'border-red-200 bg-red-50 text-red-600'
};

const bandTitles: Record<RiskSegment, string> = {
    '1-5': '1-5 Bildirim',
    '6-10': '6-10 Bildirim',
    '11-20': '11-20 Bildirim',
    '21+': '21+ Bildirim'
};

// --- Real Map Component with Districts ---
const RealMap = ({ complaints, onDistrictSelect, filter }: { complaints: Complaint[]; onDistrictSelect: (d: string) => void; filter: string | null }) => {
    const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');

    const summary = useMemo(() => {
        const store = new Map<
            string,
            {
                count: number;
                latest: number;
                neighborhoods: Set<string>;
                categories: Partial<Record<Complaint['category'], number>>;
            }
        >();

        complaints.forEach(complaint => {
            const current = store.get(complaint.district) || {
                count: 0,
                latest: 0,
                neighborhoods: new Set<string>(),
                categories: {}
            };

            current.count += 1;
            current.latest = Math.max(current.latest, new Date(complaint.created_at).getTime());
            current.neighborhoods.add(complaint.neighborhood);
            current.categories[complaint.category] = (current.categories[complaint.category] || 0) + 1;

            store.set(complaint.district, current);
        });

        const resolveBand = (count: number): RiskSegment => {
            if (count <= 5) return '1-5';
            if (count <= 10) return '6-10';
            if (count <= 20) return '11-20';
            return '21+';
        };

        return Array.from(store.entries())
            .map(([district, data]) => {
                const categoryEntries = Object.entries(data.categories as Record<string, number>).sort((a, b) => b[1] - a[1]);
                const topCategory = (categoryEntries[0]?.[0] || 'DIGER') as Complaint['category'];

                return {
                    district,
                    count: data.count,
                    band: resolveBand(data.count),
                    latest: data.latest,
                    neighborhoods: Array.from(data.neighborhoods).slice(0, 3),
                    topCategory
                };
            })
            .sort((a, b) => b.count - a.count);
    }, [complaints]);

    const filtered = useMemo(() => {
        if (riskFilter === 'ALL') return summary;
        return summary.filter(item => item.band === riskFilter);
    }, [summary, riskFilter]);

    const mapDistricts = useMemo(() => {
        const base = riskFilter === 'ALL' ? summary : filtered;
        if (filter) {
            const selected = summary.find(item => item.district === filter);
            if (selected && !base.some(item => item.district === selected.district)) {
                return [...base, selected];
            }
        }
        return base;
    }, [summary, filtered, filter, riskFilter]);

    const hotspots = (riskFilter === 'ALL' ? summary : filtered).slice(0, 6);
    const legendBands: RiskSegment[] = ['1-5', '6-10', '11-20', '21+'];
    const riskFilters: RiskFilter[] = ['ALL', '1-5', '6-10', '11-20', '21+'];

    const handleSelect = (district: string) => {
        onDistrictSelect(district);
    };

    if (summary.length === 0) {
        return (
            <div className="bursa-card p-6 text-center">
                <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-cyan-100 text-emerald-600 shadow">
                    <CheckCircle2 className="h-8 w-8" />
                </div>
                <h4 className="mb-1 text-sm font-semibold text-slate-700">Şikayet kaydı bulunmuyor</h4>
                <p className="text-sm text-slate-500">Bursa genelinde son dönemde bildirim alınmadı.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-cyan-50 to-white p-4">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.08),_transparent_65%)]" />

                <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h4 className="text-sm font-semibold text-slate-700">Bursa Isı Haritası</h4>
                        <p className="text-xs text-slate-500">Şikayet yoğunluğu büyüklük ve renk ile gösterilir.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {riskFilters.map(option => (
                            <button
                                key={option}
                                onClick={() => setRiskFilter(option)}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                                    option === riskFilter
                                        ? 'border-transparent bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-md'
                                        : 'border-emerald-100 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
                                }`}
                            >
                                {option === 'ALL' ? 'Tümü' : bandTitles[option as RiskSegment]}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative z-10 mt-6 h-72 overflow-hidden rounded-xl border border-white/60 bg-white/70">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(6,182,212,0.12)_0%,rgba(6,182,212,0)_70%)]" />

                    {mapDistricts.map(item => {
                        const position = districtPositions[item.district];
                        if (!position) return null;
                        const gradient = gradientByBand[item.band];
                        const size = Math.min(90, 28 + item.count * 3);

                        return (
                            <div
                                key={item.district}
                                style={{
                                    left: `${position.x}%`,
                                    top: `${position.y}%`,
                                    transform: 'translate(-50%, -50%)'
                                }}
                                className="absolute flex flex-col items-center"
                            >
                                <button
                                    onClick={() => handleSelect(item.district)}
                                    style={{ width: size, height: size }}
                                    className={`flex items-center justify-center rounded-full border border-white/80 bg-gradient-to-br ${gradient} text-white shadow-lg shadow-emerald-500/20 transition-transform duration-200 focus:outline-none ${
                                        filter === item.district ? 'ring-4 ring-offset-2 ring-emerald-400 scale-105' : 'hover:scale-110'
                                    }`}
                                >
                                    <span className="text-sm font-semibold">{item.count}</span>
                                </button>
                                <span
                                    className={`mt-2 whitespace-nowrap rounded-full border border-emerald-100 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-600 ${
                                        filter === item.district ? 'text-emerald-700' : ''
                                    }`}
                                >
                                    {item.district}
                                </span>
                            </div>
                        );
                    })}

                    {mapDistricts.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-500">
                            Seçilen aralıkta harita verisi yok.
                        </div>
                    )}

                    <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap items-center justify-center gap-3 rounded-full bg-white/80 px-4 py-2 text-[11px] font-medium text-slate-500 shadow">
                        {legendBands.map(band => (
                            <span key={band} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${chipByBand[band]}`}>
                                <span className={`block h-2 w-2 rounded-full bg-gradient-to-r ${gradientByBand[band]}`} />
                                {bandTitles[band]}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bursa-card p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-semibold text-slate-800">Öne Çıkan Bölgeler</h4>
                        <p className="text-xs text-slate-500">Toplam {complaints.length} bildirim arasında öne çıkan ilçeler.</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">{hotspots.length} bölge</span>
                </div>

                {hotspots.length === 0 ? (
                    <p className="text-sm text-slate-500">Seçilen aralıkta kayıt bulunamadı.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {hotspots.map(item => (
                            <button
                                key={`list-${item.district}`}
                                onClick={() => handleSelect(item.district)}
                                className={`group flex items-center justify-between rounded-xl border border-emerald-100 px-4 py-3 text-left transition-all duration-200 ${
                                    filter === item.district
                                        ? 'border-emerald-300 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10'
                                        : 'bg-white hover:-translate-y-0.5 hover:border-emerald-300'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${gradientByBand[item.band]} text-sm font-semibold text-white shadow-md`}>
                                        {item.count}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{item.district}</p>
                                        <p className="text-[11px] text-slate-500">
                                            {(item.neighborhoods.length > 0 ? item.neighborhoods.join(', ') : 'Mahalle verisi yok') +
                                                ' · ' +
                                                new Date(item.latest).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <Badge type={item.topCategory} />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Logout Confirmation Modal ---
const LogoutModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean, onClose: () => void, onConfirm: () => void }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm relative z-10 shadow-2xl animate-scale-in">
                <div className="w-14 h-14 bg-gradient-to-br from-rose-100 to-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <LogOut className="w-7 h-7 text-rose-500" />
                </div>
                <h3 className="text-lg font-semibold text-center text-slate-800 mb-2">Çıkış Yapılıyor</h3>
                <p className="text-center text-sm text-slate-500 mb-6">Oturumu kapatmak istediğinize emin misiniz?</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-all duration-200">Vazgeç</button>
                    <button onClick={onConfirm} className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-red-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-rose-500/30 transition-all duration-200">Çıkış Yap</button>
                </div>
            </div>
        </div>
    );
};

const deriveNameParts = (name: string) => {
    const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
    const firstName = parts.shift() ?? '';
    const lastName = parts.join(' ');
    return { firstName, lastName };
};

const ProfileSidebar = ({
    isOpen,
    onClose,
    user,
    setUser,
    onLogout
}: {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    setUser: (user: User) => void;
    onLogout: () => void;
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [myComplaints, setMyComplaints] = useState<Complaint[]>([]);
    const [formData, setFormData] = useState(() => {
        const nameParts = deriveNameParts(user.name);
        return {
            firstName: nameParts.firstName,
            lastName: nameParts.lastName,
            district: user.district,
            neighborhood: user.neighborhood,
            buildingNo: user.building_no
        };
    });

    useEffect(() => {
        if (!isOpen) return;
        const nameParts = deriveNameParts(user.name);
        setFormData({
            firstName: nameParts.firstName,
            lastName: nameParts.lastName,
            district: user.district,
            neighborhood: user.neighborhood,
            buildingNo: user.building_no
        });
    }, [user, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        let mounted = true;
        setLoading(true);
        api
            .getUserComplaints(user.phone)
            .then(results => {
                if (mounted) {
                    setMyComplaints(results);
                }
            })
            .catch(() => {
                /* no-op */
            })
            .finally(() => {
                if (mounted) {
                    setLoading(false);
                }
            });
        return () => {
            mounted = false;
        };
    }, [isOpen, user.phone]);

    const districts = useMemo(() => Object.keys(BURSA_LOCATIONS), []);
    const neighborhoods = useMemo(() => BURSA_LOCATIONS[formData.district] || [], [formData.district]);

    const handleFieldChange = (key: keyof typeof formData, value: string) => {
        setFormData(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleDistrictChange = (value: string) => {
        setFormData(prev => ({
            ...prev,
            district: value,
            neighborhood: ''
        }));
    };

    const handleSave = async () => {
        if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.district || !formData.neighborhood || !formData.buildingNo.trim()) {
            alert('Lütfen tüm alanları doldurun.');
            return;
        }

        const updatedUser: User = {
            ...user,
            name: `${formData.firstName} ${formData.lastName}`.trim(),
            district: formData.district,
            neighborhood: formData.neighborhood,
            building_no: formData.buildingNo
        };

        try {
            setLoading(true);
            const saved = await api.updateUser(updatedUser);
            setUser(saved);
            setIsEditing(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Profil güncellenemedi.';
            alert(message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteComplaint = async (complaintId: string) => {
        if (!window.confirm('Bu bildirimi silmek istediğinize emin misiniz?')) return;
        try {
            await api.deleteComplaint(complaintId, user.phone);
            setMyComplaints(prev => prev.filter(c => c.id !== complaintId));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Şikayet silinemedi.';
            alert(message);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <LogoutModal
                isOpen={showLogoutConfirm}
                onClose={() => setShowLogoutConfirm(false)}
                onConfirm={() => {
                    setShowLogoutConfirm(false);
                    onLogout();
                }}
            />

            <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

            <div className="fixed inset-y-0 left-0 z-50 w-[85%] max-w-sm transform bg-white shadow-2xl transition-transform duration-300 ease-out md:max-w-md">
                <div className="flex h-full flex-col rounded-r-2xl">
                    <div className="flex items-center justify-between rounded-tr-2xl bg-gradient-to-r from-cyan-600 to-teal-600 p-5 text-white">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                                <UserIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="font-semibold">Profilim</h2>
                                <p className="text-xs text-cyan-100">{user.phone}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
                        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                                <h3 className="text-sm font-semibold text-slate-800">Kişisel Bilgiler</h3>
                                {!isEditing ? (
                                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-xs font-medium text-cyan-600 transition-colors hover:text-cyan-700">
                                        <Edit2 className="h-3 w-3" /> Düzenle
                                    </button>
                                ) : (
                                    <div className="flex gap-3 text-xs">
                                        <button onClick={() => setIsEditing(false)} className="text-slate-400 transition-colors hover:text-slate-600">
                                            İptal
                                        </button>
                                        <button onClick={handleSave} className="text-cyan-600 transition-colors hover:text-cyan-700">
                                            Kaydet
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 p-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-400">Ad</label>
                                        {isEditing ? (
                                            <input
                                                value={formData.firstName}
                                                onChange={e => handleFieldChange('firstName', e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-800 outline-none transition-all focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                                            />
                                        ) : (
                                            <p className="text-sm font-medium text-slate-800">{formData.firstName}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-400">Soyad</label>
                                        {isEditing ? (
                                            <input
                                                value={formData.lastName}
                                                onChange={e => handleFieldChange('lastName', e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-800 outline-none transition-all focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                                            />
                                        ) : (
                                            <p className="text-sm font-medium text-slate-800">{formData.lastName}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-400">İlçe</label>
                                        {isEditing ? (
                                            <select
                                                value={formData.district}
                                                onChange={e => handleDistrictChange(e.target.value)}
                                                className="w-full appearance-none rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-800 outline-none transition-all focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                                            >
                                                {districts.map(item => (
                                                    <option key={item} value={item}>
                                                        {item}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="text-sm font-medium text-slate-800">{formData.district}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-400">Mahalle</label>
                                        {isEditing ? (
                                            <select
                                                value={formData.neighborhood}
                                                onChange={e => handleFieldChange('neighborhood', e.target.value)}
                                                className="w-full appearance-none rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-800 outline-none transition-all focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                                            >
                                                <option value="">Seçiniz</option>
                                                {neighborhoods.map(item => (
                                                    <option key={item} value={item}>
                                                        {item}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="text-sm font-medium text-slate-800">{formData.neighborhood}</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-400">Bina No</label>
                                    {isEditing ? (
                                        <input
                                            value={formData.buildingNo}
                                            onChange={e => handleFieldChange('buildingNo', e.target.value)}
                                            className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-800 outline-none transition-all focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                                        />
                                    ) : (
                                        <p className="text-sm font-medium text-slate-800">{formData.buildingNo}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                            <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                                <h3 className="text-sm font-semibold text-slate-800">Şikayet Geçmişim</h3>
                            </div>

                            <div className="p-4">
                                {loading ? (
                                    <div className="py-6">
                                        <LoadingSpinner />
                                    </div>
                                ) : myComplaints.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-slate-400">Kayıt bulunamadı.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {myComplaints.map(complaint => (
                                            <div key={complaint.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                                                <div className="mb-2 flex items-start justify-between">
                                                    <Badge type={complaint.category} />
                                                    <button
                                                        onClick={() => handleDeleteComplaint(complaint.id)}
                                                        className="flex items-center gap-1 text-xs text-rose-400 transition-colors hover:text-rose-600"
                                                    >
                                                        <Trash2 className="h-3 w-3" /> Sil
                                                    </button>
                                                </div>
                                                <p className="mb-2 line-clamp-2 text-xs text-slate-600">{complaint.text}</p>
                                                <div className="text-right text-[10px] text-slate-400">{new Date(complaint.created_at).toLocaleDateString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-br-2xl border-t border-slate-100 bg-white p-4">
                        <button
                            onClick={() => setShowLogoutConfirm(true)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-200"
                        >
                            <LogOut className="h-4 w-4" /> Çıkış
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- Citizen Screens ---

const CitizenLogin = ({ onLogin, onBack }: { onLogin: (u: User) => void, onBack: () => void }) => {
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [step, setStep] = useState<'INPUT' | 'VERIFY'>('INPUT');
  const [loading, setLoading] = useState(false);
  
  // Data
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [regData, setRegData] = useState({ firstName: '', lastName: '', district: 'Nilüfer', neighborhood: '', building_no: '' });

  // Validations
  const isPhoneValid = phone.length === 11 && phone.startsWith('0');
  const isRegValid = regData.firstName.length >= 2 && regData.lastName.length >= 2 && regData.district && regData.neighborhood && regData.building_no;

  const resetFlow = () => {
      setStep('INPUT');
      setOtp('');
  }

  // Handle Initial Submit (Check Existence + Send OTP)
  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isPhoneValid) {
        alert("Lütfen geçerli bir cep telefonu giriniz (Örn: 05551234567)");
        return;
    }

    setLoading(true);
    try {
        const exists = await api.checkUserExists(phone);

        if (tab === 'LOGIN') {
            if (!exists) {
                alert("Bu numara ile kayıt bulunamadı. Lütfen 'Kayıt Ol' sekmesinden üyelik oluşturun.");
                setLoading(false);
                return;
            }
        } else {
            // REGISTER
            if (exists) {
                alert("Bu numara zaten kayıtlı. Lütfen 'Giriş Yap' sekmesini kullanın.");
                setLoading(false);
                return;
            }
        }

        // If checks pass, send OTP
        await api.sendOTP(phone);
        // FORCE STEP CHANGE
        setStep('VERIFY');

    } catch (e: any) {
        alert(e.message || "Bağlantı hatası, tekrar deneyin.");
    } finally {
        setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          // If Registering, pass regData. If Logging in, pass nothing.
          // Concatenate name for storage
          const userData = tab === 'REGISTER' ? {
              name: `${regData.firstName.trim()} ${regData.lastName.trim()}`,
              district: regData.district,
              neighborhood: regData.neighborhood,
              building_no: regData.building_no
          } : undefined;

          const res = await api.verifyAndLogin(
              phone, 
              otp, 
              userData
          );
          
          if (res.user) {
              onLogin(res.user);
          }
      } catch (err: any) {
          alert(err.message || "Hatalı kod veya işlem başarısız.");
      } finally {
          setLoading(false);
      }
  };

  const handleResendOTP = async () => {
      setLoading(true);
      try {
          await api.sendOTP(phone);
          alert("Kod tekrar gönderildi!");
      } catch(e: any) {
          alert(e.message);
      } finally {
          setLoading(false);
      }
  };

  const districts = Object.keys(BURSA_LOCATIONS);
  const neighborhoods = BURSA_LOCATIONS[regData.district] || [];

    return (
        <div className="citizen-shell">
            <button
                onClick={onBack}
                className="absolute top-6 left-6 w-10 h-10 rounded-xl bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900 hover:shadow-md transition-all duration-200"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="mobile-shell flex flex-col justify-center px-6 py-12 gap-6">
                <div className="text-center animate-fade-in">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-cyan-600 mx-auto flex items-center justify-center mb-4 rounded-2xl shadow-lg">
                        <Droplet className="w-10 h-10 text-white" fill="currentColor" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ULUDAGFLOW</h1>
                    <p className="text-sm text-slate-500 mt-2">Yeşil Bursa'nın su kayıt defteri</p>
                </div>

                <div className="bursa-card p-2 flex animate-fade-in-up stagger-1">
                    <button
                        onClick={() => { setTab('LOGIN'); resetFlow(); }}
                        className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${tab === 'LOGIN' ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Giriş Yap
                    </button>
                    <button
                        onClick={() => { setTab('REGISTER'); resetFlow(); }}
                        className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${tab === 'REGISTER' ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Kayıt Ol
                    </button>
                </div>

                <div className="bursa-card shadow-xl p-6 animate-fade-in-up stagger-2">
                    {step === 'INPUT' && (
                        <form onSubmit={handleSubmit}>
                            {tab === 'REGISTER' && (
                                <div className="space-y-1 mb-4 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            label="Ad"
                                            placeholder="Adınız"
                                            value={regData.firstName}
                                            onChange={(e: any) => setRegData({ ...regData, firstName: e.target.value })}
                                            required
                                        />
                                        <Input
                                            label="Soyad"
                                            placeholder="Soyadınız"
                                            value={regData.lastName}
                                            onChange={(e: any) => setRegData({ ...regData, lastName: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Select
                                            label="İlçe"
                                            options={districts}
                                            value={regData.district}
                                            onChange={(e: any) => setRegData({ ...regData, district: e.target.value, neighborhood: '' })}
                                        />
                                        <Select
                                            label="Mahalle"
                                            options={neighborhoods}
                                            value={regData.neighborhood}
                                            onChange={(e: any) => setRegData({ ...regData, neighborhood: e.target.value })}
                                        />
                                    </div>
                                    <Input
                                        label="Bina No"
                                        placeholder="No: 5"
                                        value={regData.building_no}
                                        onChange={(e: any) => setRegData({ ...regData, building_no: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Cep Telefonu</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="tel"
                                        className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 outline-none transition-all text-slate-800"
                                        placeholder="0555 123 45 67"
                                        maxLength={11}
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    {tab === 'LOGIN' ? 'Kayıtlı numaranızla Bursa su kayıtlarına erişin.' : 'Doğrulama kodu SMS ile iletilecektir.'}
                                </p>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading || !isPhoneValid || (tab === 'REGISTER' && !isRegValid)}
                                className="w-full"
                            >
                                {loading ? 'İşleniyor...' : tab === 'LOGIN' ? 'Giriş Yap' : 'Kayıt Ol'} <ArrowRight className="w-4 h-4" />
                            </Button>
                        </form>
                    )}

                    {step === 'VERIFY' && (
                        <form onSubmit={handleVerify}>
                            <div className="text-center mb-6">
                                <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-cyan-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                                    <Lock className="w-7 h-7 text-emerald-600" />
                                </div>
                                <h3 className="font-semibold text-slate-800 text-lg">Doğrulama</h3>
                                <p className="text-sm text-slate-500 mt-1">{phone} numarasına gönderilen kodu girin</p>
                            </div>
                            <div className="mb-6">
                                <input
                                    className="w-full px-4 py-4 border-2 border-slate-200 focus:border-emerald-500 rounded-xl outline-none text-center text-2xl tracking-[0.5em] font-mono text-slate-800 transition-colors"
                                    placeholder="000000"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || otp.length < 6}
                                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-50 transition-all duration-200 mb-3"
                            >
                                {loading ? 'Doğrulanıyor...' : 'Onayla'}
                            </button>

                            <button type="button" onClick={handleResendOTP} disabled={loading} className="w-full py-2.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
                                Kodu tekrar gönder
                            </button>

                            <button type="button" onClick={resetFlow} className="w-full mt-2 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">
                                Numarayı değiştir
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

const CitizenMain = ({ user, setUser, onLogout, onNavigate }: any) => {
  const [activeTab, setActiveTab] = useState<TabView>('ALERTS');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapFilter, setMapFilter] = useState<string | null>(null);
  const [isProfileOpen, setProfileOpen] = useState(false);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        const [alertData, complaintData] = await Promise.all([
            api.getAlerts(user.district, user.neighborhood),
            api.getComplaints()
        ]);
        setAlerts(alertData);
        setComplaints(complaintData);
        setLoading(false);
    };
    fetchData();
  }, [user, activeTab]);

  const handleLike = async (id: string) => {
      await api.toggleLikeComplaint(id, user.id);
      setComplaints(prev => prev.map(c => {
          if (c.id === id) {
              const isLiked = c.likedBy.includes(user.id);
              return {
                  ...c,
                  likes: isLiked ? c.likes - 1 : c.likes + 1,
                  likedBy: isLiked ? c.likedBy.filter(uid => uid !== user.id) : [...c.likedBy, user.id]
              };
          }
          return c;
      }));
  };

  const renderAlerts = () => (
    <div className="space-y-4">
        {alerts.length === 0 ? (
            <div className="text-center py-16 bursa-card animate-fade-in">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-slate-800 mb-2 text-lg">Sorunsuz Akış</h3>
                <p className="text-sm text-slate-500">{user.district}, {user.neighborhood} bölgesinde<br/>aktif kesinti bulunmuyor.</p>
            </div>
        ) : (
            alerts.map((alert, idx) => (
            <div key={alert.id} className={`bursa-card p-5 animate-fade-in-up stagger-${(idx % 4) + 1}`}>
                <div className={`h-1.5 w-20 mb-4 rounded-full ${alert.risk_level === 'HIGH' ? 'bg-gradient-to-r from-red-500 to-rose-400' : 'bg-gradient-to-r from-amber-500 to-orange-400'}`}></div>
                <div className="flex justify-between items-start mb-3">
                    <Badge type={alert.risk_level} />
                    <span className="text-xs text-slate-400 font-medium">
                        {new Date(alert.start_datetime).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                    </span>
                </div>
                <h4 className="font-semibold text-slate-800 mb-2">{alert.district} Genelinde Uyarı</h4>
                <p className="text-sm text-slate-600 mb-4 leading-relaxed">{alert.message}</p>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                     <span>Bitiş: {new Date(alert.end_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                     <span className="font-semibold text-cyan-600">BUSKİ</span>
                </div>
            </div>
            ))
        )}
    </div>
  );

  const renderMap = () => (
      <div className="space-y-3">
          <div className="bursa-card p-4">
            <h3 className="font-medium text-gray-900 mb-1 flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-cyan-600" /> Bursa Su Durumu
            </h3>
            <p className="text-xs text-slate-500 mb-4">İlçelere tıklayarak detayları görebilirsiniz.</p>
            <RealMap 
                complaints={complaints} 
                onDistrictSelect={(d) => setMapFilter(d === mapFilter ? null : d)} 
                filter={mapFilter}
            />
          </div>

             {mapFilter && (
                 <div className="bursa-card p-4 animate-fade-in-up">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-slate-800">{mapFilter} Bölgesi</h3>
                    <button onClick={() => setMapFilter(null)} className="text-xs text-cyan-600 hover:text-cyan-700 font-medium transition-colors">Tümünü Göster</button>
                 </div>
                 <div className="space-y-2">
                     {complaints.filter(c => c.district === mapFilter).length === 0 ? (
                         <p className="text-sm text-slate-500">Şikayet bulunmuyor.</p>
                     ) : (
                        complaints.filter(c => c.district === mapFilter).slice(0,3).map(c => (
                            <div key={c.id} className="text-sm border-t border-slate-100 pt-2">
                                <div className="flex justify-between mb-1">
                                    <span className="font-medium text-slate-700">{formatCategoryLabel(c.category)}</span>
                                    <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                </div>
                                <p className="text-slate-600 line-clamp-1">{c.text}</p>
                            </div>
                        ))
                     )}
                 </div>
             </div>
          )}
      </div>
  );

  const renderSocial = () => (
      <div className="space-y-4 pb-20">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800">Halkın Sesi</h3>
            <span className="text-xs bg-cyan-50 text-cyan-700 px-3 py-1.5 rounded-full font-medium">{complaints.length} Bildirim</span>
          </div>
          
          {complaints.map((complaint, idx) => (
              <div key={complaint.id} className={`bursa-card p-4 animate-fade-in-up stagger-${(idx % 4) + 1}`}>
                  <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl flex items-center justify-center text-sm font-semibold text-white shadow-sm">
                              {complaint.user_name.charAt(0)}
                          </div>
                          <div>
                              <p className="font-semibold text-slate-800 text-sm">{complaint.user_name}</p>
                              <p className="text-xs text-slate-400">{complaint.district}, {complaint.neighborhood}</p>
                          </div>
                      </div>
                      <Badge type={complaint.category} />
                  </div>
                  
                  <p className="text-sm text-slate-700 mb-4 leading-relaxed">{complaint.text}</p>
                  
                  {complaint.adminReply && (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-500 rounded-lg p-3 mb-4">
                          <p className="text-xs font-semibold text-emerald-700 mb-1">BUSKİ Yanıtı</p>
                          <p className="text-sm text-slate-700">{complaint.adminReply}</p>
                      </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <button 
                        onClick={() => handleLike(complaint.id)}
                        className={`flex items-center gap-2 text-sm transition-all duration-200 ${complaint.likedBy.includes(user.id) ? 'text-cyan-600 font-semibold' : 'text-slate-400 hover:text-cyan-500'}`}
                      >
                          <ThumbsUp className={`w-4 h-4 ${complaint.likedBy.includes(user.id) ? 'fill-cyan-600' : ''}`} />
                          <span>{complaint.likes}</span>
                      </button>
                      <span className="text-xs text-slate-400">
                          {new Date(complaint.created_at).toLocaleDateString()}
                      </span>
                  </div>
              </div>
          ))}
      </div>
  );

    return (
        <div className="citizen-shell font-inter">
            <header className="citizen-header">
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => setProfileOpen(true)}
                        className="flex items-center gap-3"
                    >
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-md">
                            <UserIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold">Bursa Su Portalı</p>
                            <h2 className="text-sm font-semibold text-slate-800">Merhaba, {user.name.split(' ')[0]}</h2>
                        </div>
                    </button>

                    <div className="flex items-center gap-2 text-xs text-slate-600 bg-white/80 px-3 py-2 rounded-lg font-medium border border-emerald-100">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                        {user.district}
                    </div>
                </div>
            </header>

            <div className="citizen-content">
                <div className="bursa-card p-2 flex mb-6 shadow-sm">
                    {[
                        { id: 'ALERTS', icon: Bell, label: 'Uyarılar' },
                        { id: 'SOCIAL', icon: Users, label: 'Mahalle Akışı' }
                    ].map((tab: any) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabView)}
                            className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-semibold rounded-xl transition-all duration-200 ${
                                activeTab === tab.id
                                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-md'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {loading ? <LoadingSpinner /> : (
                    <>
                        {activeTab === 'ALERTS' && renderAlerts()}
                        {activeTab === 'SOCIAL' && renderSocial()}
                    </>
                )}
            </div>

            <button
                onClick={() => onNavigate('CITIZEN_COMPLAINT')}
                className="bursa-fab"
            >
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-semibold">Yeni Bildirim</span>
            </button>

            <div className="bursa-bottom-nav md:hidden">
                <button
                    className={activeTab === 'ALERTS' ? 'active' : ''}
                    onClick={() => setActiveTab('ALERTS')}
                >
                    <Bell />
                    Uyarılar
                </button>
                <button
                    className={activeTab === 'SOCIAL' ? 'active' : ''}
                    onClick={() => setActiveTab('SOCIAL')}
                >
                    <Users />
                    Akış
                </button>
            </div>

            <ProfileSidebar
                isOpen={isProfileOpen}
                onClose={() => setProfileOpen(false)}
                user={user}
                setUser={setUser}
                onLogout={onLogout}
            />
        </div>
    );
};

const NewComplaint = ({ user, onBack }: { user: User, onBack: () => void }) => {
  const [text, setText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<Complaint | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setAnalyzing(true);
    setError('');
    try {
        const complaint = await api.postComplaint(user, text);
        setResult(complaint);
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Hata oluştu";
        setError(errorMsg);
    } finally {
        setAnalyzing(false);
    }
  };

  if (result) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/30 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30 animate-scale-in">
                <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2 animate-fade-in-up stagger-1">Şikayetiniz Alındı</h2>
            <p className="text-slate-500 mb-8 animate-fade-in-up stagger-2">Halkın Sesi akışında yayınlandı.</p>
            
            <div className="bg-white rounded-xl shadow-lg shadow-slate-200/50 w-full max-w-sm p-5 mb-8 text-left animate-fade-in-up stagger-3">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Kategori</p>
                <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{formatCategoryLabel(result.category)}</span>
                    <Badge type={result.category} />
                </div>
            </div>

            <button onClick={onBack} className="w-full max-w-sm py-3.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-200 animate-fade-in-up stagger-4">
              Ana Sayfaya Dön
            </button>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/20 to-slate-50 flex flex-col">
       <div className="bg-white/80 backdrop-blur-lg border-b border-slate-100 p-4 flex items-center gap-4 sticky top-0 z-20">
            <button onClick={onBack} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
            <h2 className="font-semibold text-slate-800">Sorun Bildir</h2>
        </div>
        <div className="flex-1 p-5">
            <label className="block text-slate-800 font-semibold mb-3">Ne tür bir sorun yaşıyorsunuz?</label>
            <div className="relative">
                <textarea 
                    className="w-full h-48 p-4 border-2 border-slate-200 focus:border-cyan-500 rounded-xl outline-none resize-none text-slate-800 bg-white placeholder:text-slate-400 transition-colors"
                    placeholder="Örn: Özlüce mahallesinde sular çok az akıyor..."
                    value={text}
                    onChange={e => setText(e.target.value)}
                ></textarea>
                <div className="absolute bottom-4 right-4 text-xs text-slate-400 font-medium">
                    {text.length}
                </div>
            </div>
            
            <div className="mt-4 flex items-start gap-3 bg-gradient-to-r from-cyan-50 to-teal-50 border border-cyan-100 rounded-xl p-4">
                <Radio className="w-5 h-5 text-cyan-500 mt-0.5" />
                <div>
                    <p className="font-semibold text-sm text-slate-800 mb-1">Otomatik Analiz</p>
                    <p className="text-xs text-slate-500">Metin AI tarafından analiz edilip kategorize edilecek.</p>
                </div>
            </div>

            {error && (
                <div className="mt-4 flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 animate-fade-in">
                    <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5" />
                    <div>
                        <p className="font-semibold text-sm text-rose-800 mb-1">Reddedildi</p>
                        <p className="text-xs text-rose-700">{error}</p>
                    </div>
                </div>
            )}
        </div>
        <div className="p-5 bg-white/80 backdrop-blur-lg border-t border-slate-100">
            <button 
                onClick={handleSubmit} 
                disabled={analyzing || text.length < 5} 
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2"
            >
                {analyzing ? 'Analiz Ediliyor...' : (
                  <>Yayınla <Send className="w-4 h-4" /></>
                )}
            </button>
        </div>
    </div>
  );
};

// --- Admin Screens ---

const AdminDashboard = ({ admin, onLogout }: { admin: Admin, onLogout: () => void }) => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [broadcastForm, setBroadcastForm] = useState({ district: 'Nilüfer', neighborhood: '', message: '', risk: 'MEDIUM' as RiskLevel });
    const [sending, setSending] = useState(false);
    const [activeSection, setActiveSection] = useState<'overview' | 'complaints' | 'broadcast' | 'maps'>('overview');
    
    // Admin Filters
    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'DATE' | 'LIKES'>('DATE');
    const [replyText, setReplyText] = useState<string>('');
    const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
    const [generatingAIReply, setGeneratingAIReply] = useState<string | null>(null);

    const refreshData = async () => {
        const s = await api.getDashboardStats();
        const c = await api.getComplaints();
        setStats(s);
        setComplaints(c);
    };

    useEffect(() => { refreshData(); }, []);

    const handleBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        await api.broadcastAlert({
            district: broadcastForm.district,
            neighborhood: broadcastForm.neighborhood || null,
            message: broadcastForm.message,
            risk_level: broadcastForm.risk,
            start_datetime: new Date().toISOString(),
            end_datetime: new Date(Date.now() + 86400000).toISOString()
        });
        alert("Duyuru yayınlandı!");
        setSending(false);
        setBroadcastForm({ ...broadcastForm, message: '' });
        refreshData();
    };

    const handleReply = async (id: string) => {
        if(!replyText) return;
        await api.adminReplyComplaint(id, replyText);
        setReplyText('');
        setActiveReplyId(null);
        refreshData();
    };

    const handleGenerateAIReply = async (id: string) => {
        setGeneratingAIReply(id);
        try {
            const aiGeneratedReply = await api.generateAdminAIReply(id);
            setReplyText(aiGeneratedReply);
            setActiveReplyId(id);
        } catch (e: any) {
            alert('Taslak oluşturulamadı: ' + e.message);
        } finally {
            setGeneratingAIReply(null);
        }
    };

    const handleDelete = async (id: string) => {
        if(window.confirm('Bu şikayeti silmek istediğinize emin misiniz?')) {
            await api.adminDeleteComplaint(id);
            refreshData();
        }
    }

    const filteredComplaints = useMemo(() => {
        let list = [...complaints];
        if (filterCategory !== 'ALL') list = list.filter(c => c.category === filterCategory);
        
        if (sortBy === 'DATE') list.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (sortBy === 'LIKES') list.sort((a,b) => b.likes - a.likes);
        
        return list;
    }, [complaints, filterCategory, sortBy]);

    // Minimal stat card
    const StatCard = ({ label, value, sub, accent, icon: Icon }: { label: string, value: string | number, sub?: string, accent?: string, icon?: any }) => (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</div>
                {Icon && <Icon className="w-4 h-4 text-slate-300" />}
            </div>
            <div className={`text-2xl font-bold ${accent || 'text-slate-800'}`}>{value}</div>
            {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
        </div>
    );

    return (
        <div className="admin-shell font-inter">
            {/* Top Bar */}
            <header className="bg-white/80 backdrop-blur-lg border-b border-slate-100 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg flex items-center justify-center shadow-md shadow-cyan-500/20">
                                <Droplet className="w-5 h-5 text-white" fill="white" />
                            </div>
                            <span className="text-sm font-bold tracking-tight text-slate-800">ULUDAGFLOW</span>
                        </div>
                        <nav className="hidden md:flex items-center gap-1">
                            {[
                                { id: 'overview', label: 'Genel' },
                                { id: 'complaints', label: 'Şikayetler' },
                                { id: 'maps', label: 'Haritalar' },
                                { id: 'broadcast', label: 'Duyuru' }
                            ].map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveSection(item.id as any)}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                                        activeSection === item.id 
                                            ? 'text-white bg-gradient-to-r from-cyan-500 to-teal-500 shadow-md' 
                                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full font-medium">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            Çevrimiçi
                        </div>
                        <button 
                            onClick={onLogout}
                            className="text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors"
                        >
                            Çıkış
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Nav */}
            <div className="md:hidden border-b border-slate-100 px-4 py-3 flex gap-2 overflow-x-auto bg-white">
                {[
                    { id: 'overview', label: 'Genel' },
                    { id: 'complaints', label: 'Şikayetler' },
                    { id: 'maps', label: 'Haritalar' },
                    { id: 'broadcast', label: 'Duyuru' }
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id as any)}
                        className={`px-4 py-2 text-xs font-semibold whitespace-nowrap rounded-lg transition-all duration-200 ${
                            activeSection === item.id 
                                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md' 
                                : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                
                {/* Overview Section */}
                {activeSection === 'overview' && (
                    <div className="space-y-8 animate-fade-in">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 mb-1">Operasyon Merkezi</h1>
                            <p className="text-sm text-slate-500">Bursa su şebekesi anlık durum özeti</p>
                        </div>

                        {stats && (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <StatCard label="Toplam Şikayet" value={stats.totalComplaints} />
                                    <StatCard label="Kritik" value={stats.activeHighRiskAlerts} accent="text-rose-600" />
                                    <StatCard label="Bugün" value={complaints.filter(c => new Date(c.created_at).toDateString() === new Date().toDateString()).length} />
                                    <StatCard label="Çözüm Oranı" value="78%" sub="son 30 gün" />
                                </div>

                                {/* Category breakdown */}
                                <div className="bursa-card p-6">
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-4">Kategori Dağılımı</div>
                                    <div className="space-y-4">
                                        {stats.complaintsByCategory.map((cat, i) => (
                                            <div key={cat.name} className="flex items-center gap-4">
                                                <span className="text-sm text-slate-600 w-24 font-medium">{cat.name}</span>
                                                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full transition-all duration-500" 
                                                        style={{ width: `${(cat.value / Math.max(...stats.complaintsByCategory.map(c => c.value))) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm text-slate-800 w-8 text-right font-semibold">{cat.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Insight Panels */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bursa-card p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-100 to-teal-100 rounded-lg flex items-center justify-center">
                                        <TrendingUp className="w-4 h-4 text-cyan-600" />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-800">Şebeke Durum İzleme</span>
                                </div>
                                <p className="text-xs text-slate-500 mb-4">Saha kayıtları ve mahkeme bildirimlerinden türetilen eğilim raporu</p>
                                <div id="network-prediction-container"></div>
                            </div>
                            
                            <div className="bursa-card p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg flex items-center justify-center">
                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-800">Arıza Tespiti</span>
                                </div>
                                <p className="text-xs text-slate-500 mb-4">Basınç ve debi sensörlerinden gelen canlı verilerin yorumlanması</p>
                                <div id="pipe-burst-container"></div>
                            </div>
                        </div>

                        {/* Recent complaints preview */}
                        <div className="bursa-card overflow-hidden">
                            <div className="p-4 border-b border-emerald-50 flex items-center justify-between bg-white/70">
                                <span className="text-sm font-semibold text-slate-800">Son Şikayetler</span>
                                <button 
                                    onClick={() => setActiveSection('complaints')}
                                    className="text-xs text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
                                >
                                    Tümünü gör →
                                </button>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {complaints.slice(0, 5).map(c => (
                                    <div key={c.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-medium text-slate-800">{c.user_name}</span>
                                                    <span className="text-xs text-slate-400">{c.district}</span>
                                                </div>
                                                <p className="text-sm text-slate-600 truncate">{c.text}</p>
                                            </div>
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getCategoryPillClass(c.category)}`}>
                                                {formatCategoryLabel(c.category)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Complaints Section */}
                {activeSection === 'complaints' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800 mb-1">Şikayetler</h1>
                                <p className="text-sm text-slate-500">{complaints.length} kayıt</p>
                            </div>
                            <select 
                                className="text-sm border border-slate-200 px-4 py-2.5 bg-white text-slate-700 rounded-lg outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
                                value={sortBy} 
                                onChange={(e: any) => setSortBy(e.target.value)}
                            >
                                <option value="DATE">Tarihe göre</option>
                                <option value="LIKES">Popülerliğe göre</option>
                            </select>
                        </div>

                        <div className="bursa-card divide-y divide-slate-100 overflow-hidden">
                            {filteredComplaints.map(c => (
                                <div key={c.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="text-sm font-semibold text-slate-800">{c.user_name}</span>
                                                <span className="text-xs text-slate-400">{c.district}, {c.neighborhood}</span>
                                            </div>
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getCategoryPillClass(c.category)}`}>
                                                {formatCategoryLabel(c.category)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-slate-400 font-medium">{c.likes} beğeni</span>
                                            <button 
                                                onClick={() => handleDelete(c.id)} 
                                                className="text-slate-300 hover:text-rose-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <p className="text-sm text-slate-700 mb-4 leading-relaxed">{c.text}</p>
                                    
                                    {c.adminReply ? (
                                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-500 rounded-lg p-3 text-sm text-slate-700">
                                            <span className="text-xs text-emerald-700 font-semibold block mb-1">Yanıtınız</span>
                                            {c.adminReply}
                                        </div>
                                    ) : (
                                        activeReplyId === c.id ? (
                                            <div className="space-y-3">
                                                <textarea 
                                                    className="w-full border-2 border-slate-200 p-3 text-sm text-slate-800 rounded-xl outline-none focus:border-cyan-500 resize-none transition-colors" 
                                                    placeholder="Yanıtınızı yazın..."
                                                    rows={3}
                                                    value={replyText}
                                                    onChange={e => setReplyText(e.target.value)}
                                                    autoFocus
                                                />
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handleReply(c.id)}
                                                        className="text-sm px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg font-medium hover:shadow-md transition-all"
                                                    >
                                                        Gönder
                                                    </button>
                                                    <button 
                                                        onClick={() => setActiveReplyId(null)}
                                                        className="text-sm px-5 py-2.5 text-slate-500 hover:text-slate-700 font-medium transition-colors"
                                                    >
                                                        İptal
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-4 pt-2">
                                                <button 
                                                    onClick={() => setActiveReplyId(c.id)}
                                                    className="text-xs text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
                                                >
                                                    Yanıtla
                                                </button>
                                                <button 
                                                    onClick={() => handleGenerateAIReply(c.id)}
                                                    disabled={generatingAIReply === c.id}
                                                    className="text-xs text-slate-400 hover:text-cyan-600 font-medium transition-colors disabled:opacity-50"
                                                >
                                                    {generatingAIReply === c.id ? 'Oluşturuluyor...' : 'Taslak önerisi al'}
                                                </button>
                                            </div>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Maps Section */}
                {activeSection === 'maps' && (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 mb-1">Su Altyapısı Harita Görünümü</h1>
                            <p className="text-sm text-slate-500">Gerçek zamanlı sızıntı tespiti, arıza risk analizi ve tahmin modelleri</p>
                        </div>

                        {/* Ana Harita - AdminMapsView (UnifiedBursaMap içerir) */}
                        <AdminMapsView complaints={complaints} />

                        {/* Gerçek GIS Verilerine Dayalı Şebeke Haritası */}
                        <RealNetworkMap complaints={complaints} />

                        {/* Arıza Risk Haritası */}
                        <div className="bursa-card p-6">
                            <div className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                Arıza Risk Haritası
                            </div>
                            <BurstRiskMap />
                        </div>
                    </div>
                )}

                {/* Broadcast Section */}
                {activeSection === 'broadcast' && (
                    <div className="max-w-lg space-y-6 animate-fade-in">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 mb-1">Duyuru Yayınla</h1>
                            <p className="text-sm text-slate-500">Vatandaşlara acil bildirim gönder</p>
                        </div>

                        <form onSubmit={handleBroadcast} className="bursa-card p-6 space-y-5">
                            <div>
                                <label className="block text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">İlçe</label>
                                <select 
                                    className="w-full border border-slate-200 p-3 text-sm text-slate-800 rounded-lg outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
                                    value={broadcastForm.district}
                                    onChange={(e) => setBroadcastForm({...broadcastForm, district: e.target.value})}
                                >
                                    {Object.keys(BURSA_LOCATIONS).map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Risk Seviyesi</label>
                                <div className="flex gap-2">
                                    {['LOW', 'MEDIUM', 'HIGH'].map(r => (
                                        <button 
                                            key={r}
                                            type="button"
                                            onClick={() => setBroadcastForm({...broadcastForm, risk: r as RiskLevel})}
                                            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                                                broadcastForm.risk === r 
                                                    ? r === 'HIGH' 
                                                        ? 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-md' 
                                                        : r === 'MEDIUM'
                                                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                                                            : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            {r === 'LOW' ? 'Düşük' : r === 'MEDIUM' ? 'Orta' : 'Yüksek'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Mesaj</label>
                                <textarea 
                                    className="w-full border border-slate-200 p-3 text-sm text-slate-800 rounded-lg outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 resize-none transition-all"
                                    placeholder="Duyuru metnini girin..."
                                    rows={5}
                                    value={broadcastForm.message}
                                    onChange={e => setBroadcastForm({...broadcastForm, message: e.target.value})}
                                    required
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={sending}
                                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 disabled:opacity-50 transition-all duration-200"
                            >
                                {sending ? 'Gönderiliyor...' : 'Duyuruyu Yayınla'}
                            </button>
                        </form>
                    </div>
                )}

            </main>
        </div>
    );
};

// --- App Entry & Router ---

export default function App() {
  const [state, setState] = useState<AppState>({
    view: 'SPLASH',
    currentUser: null,
    currentAdmin: null
  });

  // URL'den ticket ID'yi oku ve yönlendir
  useEffect(() => {
    const path = window.location.pathname;
    const ticketMatch = path.match(/\/ticket\/(TKT-[\d-]+)/);
    
    if (ticketMatch) {
      const ticketId = ticketMatch[1];
      setState(s => ({
        ...s,
        view: 'TICKET_PAGE',
        ticketId: ticketId
      }));
    }
    
    // Tarayıcı geri/ileri butonlarını dinle
    const handlePopState = () => {
      const newPath = window.location.pathname;
      const newTicketMatch = newPath.match(/\/ticket\/(TKT-[\d-]+)/);
      
      if (newTicketMatch) {
        setState(s => ({
          ...s,
          view: 'TICKET_PAGE',
          ticketId: newTicketMatch[1]
        }));
      } else if (newPath === '/' || newPath === '') {
        setState(s => ({
          ...s,
          view: 'SPLASH'
        }));
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (view: AppState['view']) => setState(s => ({ ...s, view }));

  const handleLogout = () => {
    // No window.confirm here anymore, it's handled by specific logout buttons or modals in child components
    // But for the global handler passed down to Admin Dashboard:
    if (state.view === 'ADMIN_DASHBOARD') {
         if (window.confirm("Oturumu kapatmak istediğinize emin misiniz?")) {
            setState({
                view: 'SPLASH',
                currentUser: null,
                currentAdmin: null
            });
         }
    } else {
        // For citizen, this is just a state resetter, the Modal calls it after confirmation
        setState({
            view: 'SPLASH',
            currentUser: null,
            currentAdmin: null
        });
    }
  };

    const RoleSelection = () => (
        <div className="bursa-hero">
            {/* BUSKİ Üst Bar */}
            <div className="fixed top-0 left-0 right-0 buski-topbar z-50">
                <span className="logo-text">BUSKİ Dijital Altyapı Birimi</span>
                <span className="text-slate-400">v1.0</span>
            </div>
            
            <div className="mobile-shell animate-fade-in mt-12">
                <div className="bursa-card px-8 py-10 text-center">
                    {/* Header - Sade */}
                    <div className="mb-8 flex flex-col items-center gap-2">
                        <div className="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center">
                            <Droplet className="w-7 h-7 text-white" strokeWidth={1.5} />
                        </div>
                        <h1 className="text-xl font-semibold text-slate-800 tracking-tight mt-2">ULUDAGFLOW</h1>
                        <p className="text-sm text-slate-500">Su şebekesi karar destek sistemi</p>
                    </div>

                    <div className="space-y-3 text-left">
                        {/* MODÜL A: Risk Önceliklendirme */}
                        <button
                            onClick={() => navigate('RISK_DASHBOARD')}
                            className="w-full px-4 py-4 rounded-lg flex items-center gap-4 transition-colors bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        >
                            <div className="w-10 h-10 rounded-md bg-slate-800 flex items-center justify-center text-white">
                                <AlertTriangle className="w-5 h-5" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1">
                                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Bakım Planlama</div>
                                <div className="font-medium text-slate-800 text-sm">Risk Önceliklendirme</div>
                                <div className="text-xs text-slate-500">30 günlük patlak riski tahmini</div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
                        </button>

                        {/* MODÜL A: Pipe Risk Motoru */}
                        <button
                            onClick={() => navigate('RISK_LIST')}
                            className="w-full px-4 py-4 rounded-lg flex items-center gap-4 transition-colors bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        >
                            <div className="w-10 h-10 rounded-md bg-slate-800 flex items-center justify-center text-white">
                                <MapIcon className="w-5 h-5" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1">
                                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Detaylı Analiz</div>
                                <div className="font-medium text-slate-800 text-sm">Pipe Risk Motoru</div>
                                <div className="text-xs text-slate-500">Boru bazlı risk skoru ve harita</div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
                        </button>

                        {/* MODÜL B: Mahalle Su Gerçekliği */}
                        <button
                            onClick={() => setState({ ...state, view: 'TICKET_PAGE', ticketId: 'TKT-2024-001542' })}
                            className="w-full px-4 py-4 rounded-lg flex items-center gap-4 transition-colors bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        >
                            <div className="w-10 h-10 rounded-md bg-slate-800 flex items-center justify-center text-white">
                                <Users className="w-5 h-5" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1">
                                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Vatandaş İletişimi</div>
                                <div className="font-medium text-slate-800 text-sm">Mahalle Su Gerçekliği</div>
                                <div className="text-xs text-slate-500">Ticket takip ve mahalle metrikleri</div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
                        </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <p className="text-xs text-slate-400">Operasyon verilerinden türetilmiş karar destek modülleri</p>
                    </div>
                </div>
            </div>
        </div>
    );

  const AdminLogin = ({ onLogin }: { onLogin: (admin: Admin) => void }) => {
    const [email, setEmail] = useState('admin@buski.gov.tr');
    const [pass, setPass] = useState('Buski!2024');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.adminLogin(email, pass);
            if (res.admin) onLogin(res.admin);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-6">
            <button 
                onClick={() => navigate('SPLASH')}
                className="absolute top-6 left-6 w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900 hover:shadow-md transition-all duration-200"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-sm p-8 animate-fade-in-up">
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <BarChart3 className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Yönetici Girişi</h2>
                    <p className="text-sm text-slate-500 mt-1">Kimlik doğrulaması gerekli</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">E-Posta</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-slate-200 p-3.5 text-sm rounded-xl outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Şifre</label>
                        <input 
                            type="password" 
                            value={pass} 
                            onChange={(e) => setPass(e.target.value)}
                            className="w-full border border-slate-200 p-3.5 text-sm rounded-xl outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3.5 bg-gradient-to-r from-slate-700 to-slate-800 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-slate-500/20 disabled:opacity-50 transition-all duration-200 mt-6"
                    >
                        {loading ? 'Giriş Yapılıyor...' : 'Giriş'}
                    </button>
                </form>
            </div>
        </div>
    );
  };

  switch (state.view) {
    case 'SPLASH':
        return <RoleSelection />;
    
    case 'RISK_DASHBOARD':
        return <PipeRiskDashboard />;
    
    case 'RISK_LIST':
        return <RiskListView />;
    
    case 'TICKET_PAGE':
        return <TicketPage ticketId={state.ticketId} />;
    
    default:
        return <RoleSelection />;
  }
}
