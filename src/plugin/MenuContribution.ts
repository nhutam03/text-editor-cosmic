/**
 * Interface for plugin menu contributions
 */

export interface MenuItem {
  id: string;          // Unique identifier for the menu item
  label: string;       // Display text for the menu item
  parentMenu: string;  // Parent menu where this item should appear (e.g., 'file', 'edit', 'view')
  position?: number;   // Optional position within the parent menu (lower numbers appear first)
  icon?: string;       // Optional icon name
  shortcut?: string;   // Optional keyboard shortcut
  pluginId: string;    // ID of the plugin that contributed this menu item
}

/**
 * Registry for plugin menu contributions
 */
export class MenuRegistry {
  private static instance: MenuRegistry;
  private menuItems: MenuItem[] = [];
  private listeners: Array<(items: MenuItem[]) => void> = [];

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): MenuRegistry {
    if (!MenuRegistry.instance) {
      MenuRegistry.instance = new MenuRegistry();
    }
    return MenuRegistry.instance;
  }

  /**
   * Register a menu item
   */
  public registerMenuItem(item: MenuItem): void {
    // Check if item with same ID already exists
    const existingIndex = this.menuItems.findIndex(i => i.id === item.id);
    
    if (existingIndex >= 0) {
      // Replace existing item
      this.menuItems[existingIndex] = item;
    } else {
      // Add new item
      this.menuItems.push(item);
    }
    
    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Unregister all menu items for a plugin
   */
  public unregisterMenuItemsByPlugin(pluginId: string): void {
    const initialLength = this.menuItems.length;
    this.menuItems = this.menuItems.filter(item => item.pluginId !== pluginId);
    
    // Only notify if items were actually removed
    if (initialLength !== this.menuItems.length) {
      this.notifyListeners();
    }
  }

  /**
   * Get all menu items
   */
  public getMenuItems(): MenuItem[] {
    return [...this.menuItems];
  }

  /**
   * Get menu items for a specific parent menu
   */
  public getMenuItemsForParent(parentMenu: string): MenuItem[] {
    return this.menuItems
      .filter(item => item.parentMenu.toLowerCase() === parentMenu.toLowerCase())
      .sort((a, b) => (a.position || 100) - (b.position || 100));
  }

  /**
   * Add a listener for menu item changes
   */
  public addListener(listener: (items: MenuItem[]) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a listener
   */
  public removeListener(listener: (items: MenuItem[]) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    const items = this.getMenuItems();
    for (const listener of this.listeners) {
      listener(items);
    }
  }
}
