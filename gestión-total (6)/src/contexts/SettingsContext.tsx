/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { inventoryService } from '../services/inventoryService';
import { useAuth } from './AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface CompanyProfile {
  name: string;
  logoUrl?: string;
  slogan?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  bankAlias?: string;
  bankCbu?: string;
}

type Theme = 'light' | 'dark';

interface SettingsContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  t: (key: string) => string;
  preferences: Record<string, boolean>;
  togglePreference: (key: string) => void;
  loading: boolean;
  mobileCompactMode: boolean;
  setMobileCompactMode: (value: boolean) => void;
  companyProfile: CompanyProfile;
  updateCompanyProfile: (profile: Partial<CompanyProfile>) => Promise<void>;
}

const translations: Record<string, string> = {
  dashboard: 'Panel de Control',
  inventory: 'Inventario',
  sales: 'Ventas',
  purchases: 'Compras',
  finances: 'Dinero & Gastos',
  finances_desc: 'Control sencillo de dinero disponible y gastos diarios',
  warehouses: 'Almacenes',
  settings: 'Configuración',
  catalog: 'Catálogo',
  logout: 'Cerrar Sesión',
  total_products: 'Total Productos',
  total_units: 'Unidades Totales',
  locations: 'Ubicaciones',
  low_stock: 'Stock Bajo',
  recent_movements: 'Últimos Movimientos',
  view_inventory: 'Ver Inventario',
  stock_movements: 'Movimientos de Stock',
  income_expense_7d: 'Ingresos y egresos de los últimos 7 días',
  income: 'Ingresos',
  expense: 'Egresos',
  sales_vs_purchases: 'Ventas vs Compras',
  sales_purchases_7d: 'Comparativa de ventas y compras (últimos 7 días)',
  danger_zone: 'Zona de Peligro',
  reset_data: 'Reiniciar a valores predeterminados',
  reset_desc: 'Elimina todos los productos, ventas, compras, depósitos y movimientos.',
  reset_btn: 'Reiniciar Todo',
  theme: 'Tema',
  language: 'Idioma',
  light: 'Claro',
  dark: 'Oscuro',
  spanish: 'Español',
  english: 'Inglés',
  confirm_reset_title: '¿Reiniciar todos los datos?',
  confirm_reset_msg: 'Esta acción eliminará permanentemente todos tus productos, ventas, compras, depósitos y movimientos. No podrás recuperar esta información.',
  confirm_reset_btn: 'Sí, reiniciar todo',
  loading: 'Cargando...',
  search_placeholder: 'Buscar...',
  new_sale: 'Nueva Venta',
  new_purchase: 'Nueva Compra',
  add_product: 'Agregar Producto',
  edit: 'Editar',
  delete: 'Eliminar',
  save: 'Guardar',
  cancel: 'Cancelar',
  app_name: 'Gestión Total',
  settings_desc: 'Administra las preferencias de tu cuenta y datos',
  reset_success: 'Datos reiniciados con éxito',
  reset_error: 'Error al reiniciar los datos',
  loading_warehouses: 'Cargando almacenes...',
  warehouse_management: 'Gestión de Almacenes',
  warehouse_management_desc: 'Administra tus puntos de stock y distribución',
  new_warehouse: 'Nuevo Almacén',
  no_warehouses_found: 'No hay almacenes registrados',
  create_first: 'Crear el primero',
  items: 'Items',
  no_location: 'Sin ubicación',
  create_new_warehouse: 'Crear Nuevo Almacén',
  warehouse_name: 'Nombre del Almacén',
  location: 'Ubicación',
  description: 'Descripción',
  warehouse_desc_placeholder: 'Describe el propósito de este almacén...',
  create_warehouse: 'Crear Almacén',
  delete_warehouse: 'Eliminar Almacén',
  delete_warehouse_confirm: '¿Estás seguro de que deseas eliminar este almacén? Esta acción no se puede deshacer.',
  warehouse_added_success: 'Almacén agregado correctamente',
  warehouse_added_error: 'Error al agregar el almacén',
  warehouse_deleted_success: 'Almacén eliminado correctamente',
  warehouse_deleted_error: 'Error al eliminar el almacén',
  purchases_history: 'Historial de Compras',
  purchases_desc: 'Registro detallado de ingresos de mercadería',
  register_purchase: 'Registrar Compra',
  date: 'Fecha',
  product: 'Producto',
  quantity: 'Cantidad',
  unit_price: 'Precio Unit.',
  total: 'Total',
  actions: 'Acciones',
  no_purchases: 'No se encontraron compras',
  delete_purchase: 'Eliminar Compra',
  delete_purchase_confirm: '¿Estás seguro de que deseas eliminar este registro de compra? El stock del producto se ajustará automáticamente.',
  new_purchase_title: 'Registrar Nueva Compra',
  select_product: 'Seleccionar Producto',
  price_per_unit: 'Precio por Unidad',
  total_purchase: 'Total de la Compra',
  purchase_registered_success: 'Compra registrada con éxito',
  purchase_registered_error: 'Error al registrar la compra',
  purchase_deleted_success: 'Compra eliminada correctamente',
  purchase_deleted_error: 'Error al eliminar la compra',
  loading_product: 'Cargando producto...',
  product_not_found: 'Producto no encontrado',
  stock_update: 'Actualización de Stock',
  current_stock: 'Stock Actual',
  new_stock: 'Nuevo Stock',
  update_stock: 'Actualizar Stock',
  stock_update_success: 'Stock actualizado correctamente',
  stock_update_error: 'Error al actualizar el stock',
  price: 'Precio',
  category: 'Categoría',
  warehouse: 'Almacén',
  loading_inventory: 'Cargando inventario...',
  search_inventory: 'Buscar en el inventario...',
  view_all: 'Ver todos',
  new_product: 'Nuevo Producto',
  code: 'Código',
  origin: 'Procedencia',
  no_products_found: 'No se encontraron productos',
  no_description: 'Sin descripción',
  units: 'unidades',
  product_details: 'Detalles del Producto',
  close: 'Cerrar',
  edit_product: 'Editar Producto',
  product_already_exists: 'Este producto ya existe',
  edit_existing: 'Editar Existente',
  article_code: 'Código de Artículo',
  legitimate: 'Legítimo',
  generic: 'Genérico',
  imported: 'Importado',
  qty: 'Cant.',
  select_warehouse: 'Seleccionar almacén',
  save_product: 'Guardar Producto',
  product_qr_code: 'Código QR del Producto',
  qr_scan_instruction: 'Escanea este código para acceder rápidamente a la actualización de stock desde un dispositivo móvil.',
  print: 'Imprimir',
  delete_product: 'Eliminar Producto',
  delete_product_confirm: '¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.',
  product_added_success: 'Producto agregado correctamente',
  product_added_error: 'Error al agregar el producto',
  code_already_in_use: 'El código ya está en uso por',
  product_updated_success: 'Producto actualizado correctamente',
  product_updated_error: 'Error al actualizar el producto',
  product_deleted_success: 'Producto eliminado correctamente',
  product_deleted_error: 'Error al eliminar el producto',
  stock_updated: 'Stock actualizado',
  loading_sales: 'Cargando ventas...',
  total_sold_today: 'Total Vendido Hoy',
  sales_made: 'Ventas Realizadas',
  average_per_sale: 'Promedio por Venta',
  search_sales: 'Buscar ventas...',
  days: 'días',
  to: 'a',
  no_sales_found: 'No se encontraron ventas',
  total_sale: 'Total de la Venta',
  total_item: 'Total del Item',
  items_in_sale: 'Productos en esta venta',
  total_to_pay: 'Total a Pagar',
  client_information: 'Información del Cliente',
  add_products: 'Agregar Productos',
  combos: 'Combos',
  new_combo: 'Nuevo Combo',
  save_as_combo: 'Guardar como Combo',
  load_combo: 'Cargar Combo',
  combo_name: 'Nombre del Combo',
  combo_saved_success: 'Combo guardado con éxito',
  combo_loaded_success: 'Combo cargado con éxito',
  select_combo: 'Seleccionar Combo',
  no_combos: 'No hay combos guardados',
  cart_subtotal: 'Subtotal del Carrito',
  final_sale_total: 'Total Final de la Venta',
  cart_empty_error: 'El carrito está vacío',
  confirm_sale: 'Confirmar Venta',
  delete_sale: 'Eliminar Venta',
  delete_sale_confirm: '¿Estás seguro de que deseas eliminar este registro de venta? El stock del producto se ajustará automáticamente.',
  select_product_error: 'Selecciona un producto',
  insufficient_stock_error: 'Stock insuficiente',
  sale_registered_success: 'Venta registrada con éxito',
  sale_registered_error: 'Error al registrar la venta',
  sale_deleted_success: 'Venta eliminada correctamente',
  sale_deleted_error: 'Error al eliminar la venta',
  estimated_profit: 'Ganancia Estimada',
  total_potential_revenue: 'Valor de Venta Total',
  edit_sale: 'Editar Venta',
  combo_contents: 'Contenido del Combo',
  new_total: 'Nuevo Total',
  confirm_as_combo: 'Confirmar como Combo',
  register_as_combo: 'Registrar como Combo',
  combo_sale_name: 'Nombre del Combo de Venta',
  all: 'Todos',
  custom: 'Personalizado',
  qty_short: 'Cant.',
  cost: 'Costo',
  add: 'Agregar',
  subtract: 'Restar',
  back_to_dashboard: 'Volver al Panel',
  product_not_found_desc: 'El producto que buscas no existe o fue eliminado.',
  no_movements: 'No hay movimientos recientes',
  total_purchased_month: 'Total Comprado (Mes)',
  stock_investment: 'Inversión en Stock',
  active_suppliers: 'Proveedores Activos',
  search_purchases: 'Buscar compras...',
  filters: 'Filtros',
  no_purchases_found: 'No se encontraron compras',
  supplier: 'Proveedor',
  unit_cost: 'Costo Unitario',
  date_range: 'Rango de Fecha',
  all_time: 'Todo el tiempo',
  last_7_days: 'Últimos 7 días',
  last_30_days: 'Últimos 30 días',
  custom_range: 'Rango personalizado',
  all_products: 'Todos los productos',
  clear_filters: 'Limpiar Filtros',
  start_date: 'Fecha Inicio',
  end_date: 'Fecha Fin',
  register_new_purchase: 'Registrar Nueva Compra',
  total_investment: 'Inversión Total',
  confirm_purchase: 'Confirmar Compra',
  loading_purchases: 'Cargando compras...',
  status: 'Estado',
  all_statuses: 'Todos los estados',
  new: 'Nuevo',
  used: 'Usado',
  refurbished: 'Reacondicionado',
  all_warehouses: 'Todos los almacenes',
  procedencia: 'Procedencia',
  all_origins: 'Todas las procedencias',
  stock_distribution: 'Distribución de Stock',
  stock_by_warehouse: 'Cantidad de productos por cada depósito',
  total_stock: 'Stock Total',
  revenue_7d: 'Ingresos (Ventas)',
  expenses_7d: 'Egresos (Compras)',
  sales_vs_purchases_desc: 'Comparativa de flujo de caja',
  stock_levels: 'Niveles de Stock',
  stock_levels_desc: 'Productos con mayor y menor disponibilidad',
  top_products: 'Productos Top',
  low_stock_alerts: 'Alertas de Stock Bajo',
  low_stock_alert: 'Alerta de Stock Bajo',
  stock: 'Stock',
  last_14_days: 'Últimos 14 días',
  no_name: 'Sin nombre',
  unknown_product: 'Producto desconocido',
  clients: 'Clientes',
  suppliers: 'Proveedores',
  invoices: 'Facturas',
  notifications: 'Notificaciones',
  goals: 'Objetivos',
  select_client: 'Seleccionar cliente',
  select_supplier: 'Seleccionar proveedor',
  generate_invoice: 'Generar Factura',
  view_invoice: 'Ver Factura',
  client_name: 'Nombre del cliente',
  supplier_name: 'Nombre del proveedor',
  tax_id: 'ID Fiscal / RUT',
  address: 'Dirección',
  phone: 'Teléfono',
  add_client: 'Agregar Cliente',
  add_supplier: 'Agregar Proveedor',
  no_clients: 'No hay clientes registrados',
  no_suppliers: 'No hay proveedores registrados',
  last_movement: 'Último movimiento',
  warehouse_location: 'Ubicación en almacén',
  stock_history: 'Historial de stock',
  analytics: 'Analíticas',
  monthly_sales: 'Ventas mensuales',
  monthly_purchases: 'Compras mensuales',
  profit: 'Ganancia',
  revenue: 'Ingresos',
  total_stock_value: 'Valor total de stock',
  client_added_success: 'Cliente agregado con éxito',
  supplier_added_success: 'Proveedor agregado con éxito',
  invoice_generated_success: 'Factura generada con éxito',
  goal_reached: '¡Objetivo alcanzado!',
  new_notification: 'Nueva notificación',
  mark_as_read: 'Marcar como leído',
  clear_all: 'Limpiar todo',
  logo_url: 'URL del Logo',
  primary_color: 'Color Primario',
  currency_symbol: 'Símbolo de Moneda',
  save_settings: 'Guardar Configuración',
  settings_saved_success: 'Configuración guardada con éxito',
  ai_assistant: 'Asistente IA',
  ask_ai: 'Preguntar a la IA...',
  ai_thinking: 'La IA está pensando...',
  login: 'Iniciar Sesión',
  register: 'Registrarse',
  email: 'Correo Electrónico',
  password: 'Contraseña',
  forgot_password: '¿Olvidaste tu contraseña?',
  no_account: '¿No tienes una cuenta?',
  have_account: '¿Ya tienes una cuenta?',
  verify_email_sent: 'Se ha enviado un correo de verificación. Por favor, revisa tu bandeja de entrada.',
  verify_email_error: 'Error al enviar el correo de verificación.',
  login_error: 'Error al iniciar sesión. Verifica tus credenciales.',
  register_error: 'Error al registrarse. Por favor, intenta de nuevo.',
  email_not_verified: 'Por favor, verifica tu correo electrónico antes de continuar.',
  email_already_in_use: 'Este correo electrónico ya está en uso. ¿Ya tienes una cuenta?',
  invalid_credentials: 'Email o contraseña incorrectos.',
  recommendations: 'Recomendaciones',
  smart_location: 'Ubicación inteligente',
  inactivity_detected: 'Inactividad detectada',
  backup_cloud: 'Respaldo en la nube',
  restore_backup: 'Restaurar respaldo',
  user_role: 'Rol de usuario',
  admin: 'Administrador',
  employee: 'Empleado',
  access_denied: 'Acceso denegado',
  only_admin_can_reset: 'Solo el administrador puede resetear los datos',
  confirm_reset_all: '¿Estás seguro de que quieres borrar TODOS los datos? Esta acción no se puede deshacer.',
  reset_all_data: 'Resetear todos los datos',
  data_reset_success: 'Todos los datos han sido reseteados',
  data_reset_error: 'Error al resetear los datos',
  clear_product_filter: 'Limpiar filtro de producto',
  most_sold_products: 'Productos con mayor volumen de ventas',
  units_sold: 'Vender una cantidad de unidades',
  quick_mode: 'Modo Rápido',
  cart_empty: 'El carrito está vacío',
  complete_sale: 'Completar Venta',
  anonymous_client: 'Consumidor Final',
  current_sale: 'Venta Actual',
  search_product: 'Buscar producto...',
  sale_success: 'Venta realizada con éxito',
  sale_error: 'Error al realizar la venta',
  no_notifications: 'No tienes notificaciones',
  new_goal: 'Nuevo Objetivo',
  goal_title: 'Título del Objetivo',
  goal_type: '¿Qué quieres medir?',
  target_value: '¿Cuánto quieres alcanzar?',
  create_goal: 'Establecer Objetivo',
  no_goals_set: 'Aún no has definido metas para tu negocio.',
  confirm_delete_goal: '¿Borrar este objetivo?',
  total_sales_amount: 'Vender un monto total de dinero ($)',
  backup_restore: 'Copia de Seguridad',
  backup: 'Respaldar',
  restore: 'Restaurar',
  backup_success: 'Copia de seguridad creada con éxito',
  backup_error: 'Error al crear copia de seguridad',
  restore_success: 'Datos restaurados con éxito',
  restore_error: 'Error al restaurar datos',
  edit_existing_label: 'Editar Existente',
  save_product_label: 'Guardar Producto',
  tax_id_label: 'Identificación Fiscal (CUIT/RUT)',
  address_label: 'Dirección Comercial',
  phone_label: 'Teléfono de Contacto',
  currency_label: 'Moneda Principal',
  primary_color_label: 'Color de Marca',
  save_changes: 'Guardar Cambios',
  appearance: 'Apariencia',
  invoice_customization: 'Personalización de Facturas',
  invoice_customization_desc: 'Configura el diseño y la información de tus facturas.',
  invoice_template: 'Plantilla de Factura',
  minimalist: 'Minimalista',
  detailed: 'Detallado',
  show_logo: 'Mostrar Logo',
  show_tax_id: 'Mostrar Identificación Fiscal',
  show_address: 'Mostrar Dirección',
  show_phone: 'Mostrar Teléfono',
  show_email: 'Mostrar Email',
  show_client_details: 'Mostrar Detalles del Cliente',
  show_footer: 'Mostrar Pie de Página',
  footer_text: 'Texto del Pie de Página',
  upload_logo: 'Subir Logo',
  logo_uploaded: 'Logo subido correctamente',
  logo_upload_error: 'Error al subir el logo',
  light_mode: 'Modo Claro',
  dark_mode: 'Modo Oscuro',
  active_modules: 'Módulos Activos',
  modules_desc: 'Activa o desactiva funcionalidades específicas según las necesidades de tu negocio.',
  ventas: 'Ventas',
  compras: 'Compras',
  analitica: 'Analítica Avanzada',
  ia: 'Asistente IA',
  no_tax_id: 'Sin identificación fiscal',
  cloud_backups: 'Copias en la Nube',
  new_cloud_backup: 'Nueva Copia en la Nube',
  no_cloud_backups: 'No hay copias de seguridad en la nube',
  cloud_backup_success: 'Copia en la nube creada con éxito',
  cloud_backup_error: 'Error al crear copia en la nube',
  suppliers_desc: 'Administra tus proveedores y contactos comerciales',
  contact_person: 'Persona de Contacto',
  currency: 'Moneda',
  reorder_suggestion: 'Sugerencia de reposición',
  warehouse_tip: 'Consejo de Almacén',
  location_suggestion_desc: 'Organiza tus productos por frecuencia de salida para ahorrar tiempo.',
  optimized_locations: 'Eficiencia de Ubicación',
  goal_help: 'Define metas para motivar a tu equipo. Por ejemplo: "Vender 50 unidades este mes".',
  goal_target_help: 'Ingresa el número o monto que quieres alcanzar.',
  vibrant_mode: 'Modo Vibrante (Colores)',
  finish_editing: 'Finalizar Edición',
  dashboard_edit_mode: 'Modo Edición',
  add_widget: 'Agregar al Panel',
  remove_widget: 'Quitar del Panel',
  show_quick_access: 'Mostrar Accesos Rápidos',
  enable_notifications: 'Habilitar Notificaciones de Stock',
  compact_view: 'Vista Compacta en Tablas',
  invoices_desc: 'Gestiona tus comprobantes de venta y facturación',
  no_invoices_found: 'No se encontraron facturas registradas',
  clients_desc: 'Administra tu base de datos de clientes y contactos',
  number: 'Número',
  client: 'Cliente',
  min_stock: 'Stock Mínimo (Alerta)',
  min_stock_help: 'Define cuándo quieres recibir una alerta de stock bajo para este producto.',
  show_profit: 'Mostrar Ganancia en Dashboard',
  auto_backup: 'Copia de Seguridad Automática',
  backup_frequency: 'Frecuencia de Respaldo',
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
  notifications_sound: 'Sonido de Notificaciones',
  dashboard_layout: 'Diseño del Panel',
  move_up: 'Subir',
  move_down: 'Bajar',
  stats: 'Estadísticas Principales',
  secondary_stats: 'Estadísticas Secundarias',
  charts: 'Gráficos de Rendimiento',
  movements: 'Movimientos Recientes',
  bulk_upload: 'Carga Masiva',
  bulk_upload_desc: 'Sube un archivo Excel para cargar productos masivamente',
  drag_drop_excel: 'Arrastra y suelta un archivo Excel (.xlsx) aquí',
  select_file: 'Seleccionar Archivo',
  process_upload: 'Procesar Carga',
  processing_rows: 'Procesando... [{{count}} / {{total}}]',
  upload_summary: 'Resumen de Carga',
  upload_success_count: '{{count}} productos cargados correctamente',
  upload_error_count: '{{count}} productos con error',
  view_log: 'Ver log',
  select_warehouse_bulk: 'Seleccionar almacén de destino',
  invalid_file_error: 'Archivo inválido. Por favor sube un archivo .xlsx o .csv',
  no_warehouse_error: 'Por favor selecciona un almacén de destino',
  bulk_upload_complete: 'Carga masiva completada',
  bulk_purchase: 'Compra Masiva',
  select_product_to_add: 'Seleccionar producto para añadir',
  search_and_add_product: 'Buscar y añadir producto...',
  cart_empty_purchase: 'No hay productos en la lista de compra.',
  confirm_all: 'Confirmar Todo',
  enter_supplier_error: 'Ingrese un proveedor',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('interface_preferences');
    return saved ? JSON.parse(saved) : {
      vibrant_mode: true,
      compact_view: false,
      enable_notifications: true,
      notifications_sound: true,
      show_profit: true,
      auto_backup: false
    };
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('interface_preferences', JSON.stringify(preferences));
  }, [preferences]);

  const [mobileCompactMode, setMobileCompactMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('mobile_compact_mode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.innerWidth < 1024;
  });

  useEffect(() => {
    localStorage.setItem('mobile_compact_mode', String(mobileCompactMode));
  }, [mobileCompactMode]);

  const defaultProfile: CompanyProfile = {
    name: 'PulseStore',
    slogan: 'Venta de Accesorios, Repuestos & Taller',
    phone: '',
    email: user?.email || 'pulsestore07@gmail.com',
    address: '',
    taxId: '',
    bankAlias: 'PULSESTORE.PAGO'
  };

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    try {
      const userKey = user?.uid ? `company_profile_${user.uid}` : 'company_profile';
      const saved = localStorage.getItem(userKey) || localStorage.getItem('company_profile');
      if (saved) {
        return { ...defaultProfile, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Error reading company profile from localStorage', e);
    }
    return defaultProfile;
  });

  // Sync with Firestore profile if logged in
  useEffect(() => {
    if (!user?.uid) return;
    const userKey = `company_profile_${user.uid}`;
    const savedLocal = localStorage.getItem(userKey);
    if (savedLocal) {
      try {
        setCompanyProfile(prev => ({ ...prev, ...JSON.parse(savedLocal) }));
      } catch (e) {}
    }

    const loadFromFirestore = async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userDocRef);
        if (snap.exists() && snap.data()?.companyProfile) {
          const remote = snap.data().companyProfile as Partial<CompanyProfile>;
          setCompanyProfile(prev => {
            const merged = { ...prev, ...remote };
            localStorage.setItem(userKey, JSON.stringify(merged));
            localStorage.setItem('company_profile', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        // Silently fallback to local storage
      }
    };
    loadFromFirestore();
  }, [user?.uid]);

  const updateCompanyProfile = async (partial: Partial<CompanyProfile>) => {
    let nextState: CompanyProfile = { ...companyProfile, ...partial };
    setCompanyProfile(prev => {
      nextState = { ...prev, ...partial };
      try {
        if (user?.uid) {
          localStorage.setItem(`company_profile_${user.uid}`, JSON.stringify(nextState));
        }
        localStorage.setItem('company_profile', JSON.stringify(nextState));
      } catch (e) {}
      return nextState;
    });

    if (user?.uid) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { companyProfile: nextState }, { merge: true });
      } catch (err) {
        console.warn('Could not sync company profile to Firestore', err);
      }
    }
  };

  const togglePreference = (key: string) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const t = (key: string) => {
    return translations[key] || key;
  };

  return (
    <SettingsContext.Provider value={{ 
      theme, 
      setTheme, 
      t, 
      preferences, 
      togglePreference,
      loading,
      mobileCompactMode,
      setMobileCompactMode,
      companyProfile,
      updateCompanyProfile
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
