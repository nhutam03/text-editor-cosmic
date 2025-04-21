/**
 * Định nghĩa giao diện cho các plugin
 * Đây là hợp đồng giữa text-editor-app và các plugin
 */

// Menu item contributed by a plugin
export interface PluginMenuItem {
  id: string;          // Unique identifier for the menu item
  label: string;       // Display text for the menu item
  parentMenu: string;  // Parent menu where this item should appear (e.g., 'file', 'edit', 'view')
  position?: number;   // Optional position within the parent menu (lower numbers appear first)
  icon?: string;       // Optional icon name
  shortcut?: string;   // Optional keyboard shortcut
}

export interface PluginInfo {
  name: string;                // Tên plugin
  displayName?: string;        // Tên hiển thị
  version: string;             // Phiên bản plugin
  description: string;         // Mô tả plugin
  author: string;              // Tác giả plugin
  publisher?: string;          // Nhà phát hành (có thể giống author)
  publisherUrl?: string;       // URL của nhà phát hành
  iconUrl?: string;            // URL của icon plugin
  downloadCount?: number;      // Số lượt tải
  rating?: number;             // Đánh giá (0-5)
  ratingCount?: number;        // Số lượt đánh giá
  lastUpdated?: string;        // Ngày cập nhật cuối cùng
  categories?: string[];       // Danh mục
  tags?: string[];             // Thẻ
  autoUpdate?: boolean;        // Tự động cập nhật
  installed?: boolean;         // Đã cài đặt hay chưa
  menuItems?: PluginMenuItem[]; // Menu items contributed by this plugin
}

export interface PluginMessage {
  type: string;        // Loại thông điệp
  payload?: any;       // Dữ liệu thông điệp
}

export interface PluginResponse {
  success: boolean;    // Trạng thái thành công
  message: string;     // Thông báo
  data?: any;          // Dữ liệu trả về
}

// Các loại thông điệp được hỗ trợ
export enum MessageType {
  REGISTER = 'register-plugin',
  EXECUTE = 'execute-plugin',
  GET_INFO = 'get-plugin-info',
  RESPONSE = 'plugin-response',
  REGISTER_MENU = 'register-menu',
  EXECUTE_MENU_ACTION = 'execute-menu-action'
}

// Định nghĩa cấu trúc thông điệp đăng ký plugin
export interface RegisterMessage extends PluginMessage {
  type: MessageType.REGISTER;
  payload: PluginInfo;
}

// Định nghĩa cấu trúc thông điệp thực thi plugin
export interface ExecuteMessage extends PluginMessage {
  type: MessageType.EXECUTE;
  payload: {
    content: string;   // Nội dung cần xử lý
    filePath?: string; // Đường dẫn file (nếu cần)
    options?: any;     // Các tùy chọn khác
  };
}

// Định nghĩa cấu trúc thông điệp phản hồi
export interface ResponseMessage extends PluginMessage {
  type: MessageType.RESPONSE;
  payload: PluginResponse;
}

// Định nghĩa cấu trúc thông điệp đăng ký menu
export interface RegisterMenuMessage extends PluginMessage {
  type: MessageType.REGISTER_MENU;
  payload: {
    pluginName: string;   // Tên plugin đăng ký menu
    menuItems: PluginMenuItem[];  // Các mục menu đăng ký
  };
}

// Định nghĩa cấu trúc thông điệp thực thi hành động menu
export interface ExecuteMenuActionMessage extends PluginMessage {
  type: MessageType.EXECUTE_MENU_ACTION;
  payload: {
    menuItemId: string;   // ID của mục menu cần thực thi
    content?: string;     // Nội dung hiện tại (nếu cần)
    filePath?: string;    // Đường dẫn file hiện tại (nếu cần)
    options?: any;        // Các tùy chọn khác
  };
}
