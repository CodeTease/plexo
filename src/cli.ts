#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import { MepCLI } from 'mepcli';

// --- CONSTANTS ---
const VERSION = "0.1.0"; 
const CONFIG_FILE = "plexo.config.json";

// --- TYPES ---
interface PlexoConfig {
    sourceDir: string;
    variables: Record<string, string>;
}

interface InspectorResponse {
    status: 'SAME' | 'DIFFERENT' | 'ERROR';
    diff_type: 'BINARY' | 'SEMANTIC';
}

// --- UTILS ---
function getPythonCommand(): string {
    // Windows thường dùng 'python', Unix thường dùng 'python3'
    // Trừ khi người dùng setup khác, nhưng đây là safe bet.
    return process.platform === 'win32' ? 'python' : 'python3';
}

// --- CORE: PYTHON BRIDGE (STREAM BASED) ---
class PythonBridge {
    private process: ChildProcess | null = null;
    private rl: readline.Interface | null = null;
    private pendingResolver: ((value: InspectorResponse) => void) | null = null;

    start() {
        const pyCmd = getPythonCommand();
        
        // Spawn Python process
        // stdio: ['pipe', 'pipe', 'inherit'] để nếu Python crash thì nó in lỗi ra console của Node luôn
        this.process = spawn(pyCmd, [path.join(__dirname, 'core', 'inspector.py')], {
            stdio: ['pipe', 'pipe', 'inherit']
        });

        // Handle startup error (ví dụ: không tìm thấy python)
        this.process.on('error', (err) => {
            console.error(`\n[FATAL] Không thể khởi động Python Inspector bằng lệnh '${pyCmd}'.`);
            console.error(`Chi tiết: ${err.message}`);
            console.error(`Gợi ý: Hãy chắc chắn Python đã được thêm vào PATH.\n`);
            process.exit(1);
        });

        if (this.process.stdout) {
            this.rl = readline.createInterface({ input: this.process.stdout });
            this.rl.on('line', (line) => {
                if (!line.trim() || !this.pendingResolver) return;

                try {
                    const response = JSON.parse(line);
                    this.pendingResolver(response);
                    this.pendingResolver = null; 
                } catch {
                    if (this.pendingResolver) {
                        this.pendingResolver({ status: 'ERROR', diff_type: 'BINARY' });
                        this.pendingResolver = null;
                    }
                }
            });
        }
    }

    stop() {
        this.process?.kill();
    }

    async compare(source: string, target: string): Promise<InspectorResponse> {
        if (!this.process || !this.process.stdin) return { status: 'ERROR', diff_type: 'BINARY' };

        return new Promise((resolve) => {
            this.pendingResolver = resolve;
            const payload = JSON.stringify({ command: 'compare', source, target });
            
            // Write và xử lý backpressure nếu cần (nhưng json nhỏ nên kệ)
            const success = this.process?.stdin?.write(payload + '\n');
            if (!success) {
                // Nếu buffer đầy, force drain (hiếm khi xảy ra với text ngắn)
                this.process?.stdin?.once('drain', () => {});
            }
        });
    }
}

// Global instance
const bridge = new PythonBridge();

// --- LOGIC ---
function loadConfig(): PlexoConfig | null {
    const p = path.join(process.cwd(), CONFIG_FILE);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : null;
}

function renderTemplate(content: string, vars: Record<string, string>): string {
    return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] || '');
}

async function sync() {
    bridge.start();
    
    const config = loadConfig();
    if (!config || !fs.existsSync(config.sourceDir)) {
        console.error(`[!] Missing config or source dir.`);
        bridge.stop();
        process.exit(1);
    }

    const files = fs.readdirSync(config.sourceDir);
    let syncedCount = 0;

    for (const file of files) {
        const src = path.join(config.sourceDir, file);
        const dest = path.join(process.cwd(), file);
        
        if (fs.lstatSync(src).isDirectory()) continue;

        let shouldWrite = true;

        if (fs.existsSync(dest)) {
            const res = await bridge.compare(src, dest);
            
            if (res.status === 'SAME') {
                shouldWrite = false;
            } else if (res.status === 'ERROR') {
                console.warn(`[!] Inspection failed for ${file}, overwriting safely.`);
            }
        }

        if (shouldWrite) {
            const content = fs.readFileSync(src, 'utf-8');
            fs.writeFileSync(dest, renderTemplate(content, config.variables));
            console.log(`+ ${file}`);
            syncedCount++;
        }
    }

    bridge.stop();
    if (syncedCount === 0) console.log("All synced.");
}

async function init() {
    console.log(`\n>>> PLEXO v${VERSION} (CodeTease Edition) <<<\n`);
    
    const src = await MepCLI.text({ message: "Source Directory", initial: "./plexo-templates" });
    const name = await MepCLI.text({ message: "Project Name", initial: "ProjectX" });
    
    const config: PlexoConfig = {
        sourceDir: src,
        variables: { "PROJECT_NAME": name }
    };

    fs.writeFileSync(path.join(process.cwd(), CONFIG_FILE), JSON.stringify(config, null, 2));
    
    if (!fs.existsSync(src)) {
        fs.mkdirSync(src, { recursive: true });
        const example = { "b": 2, "a": 1, "name": "{{ PROJECT_NAME }}" };
        fs.writeFileSync(path.join(src, "config.json"), JSON.stringify(example, null, 2));
    }
    console.log(`Initialized.`);
}

const program = new Command();
program.name('plexo').version(VERSION);
program.command('init').action(init);
program.command('sync').action(sync);
program.parse(process.argv);