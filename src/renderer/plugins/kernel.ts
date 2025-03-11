interface Plugin {
    name: string;
    execute: (...args: any[]) => Promise<any>;
}

class Kernel {
    private plugins: Map<string, Plugin>;

    constructor() {
        this.plugins = new Map<string, Plugin>();
    }

    registerPlugin(name: string, plugin: Plugin): void {
        this.plugins.set(name, plugin);
        console.log(`Plugin ${name} registered`);
    }

    async executePlugin(name: string, ...args: any[]): Promise<any> {
        const plugin = this.plugins.get(name);
        if (plugin) {
            return await plugin.execute(...args);
        } else {
            throw new Error(`Plugin ${name} not found`);
        }
    }

    // Thêm phương thức để lấy danh sách plugin
    getPlugins(): string[] {
        return Array.from(this.plugins.keys());
    }
}

export default new Kernel();