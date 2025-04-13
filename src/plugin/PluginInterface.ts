/**
 * Định nghĩa giao diện cho các plugin
 * Đây là hợp đồng giữa text-editor-app và các plugin
 */

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
  RESPONSE = 'plugin-response'
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
