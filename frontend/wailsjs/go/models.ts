export namespace main {
	
	export class ServerStatus {
	    host: string;
	    online: boolean;
	    latency: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ServerStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.online = source["online"];
	        this.latency = source["latency"];
	        this.error = source["error"];
	    }
	}
	export class DockerStats {
	    running: number;
	    stopped: number;
	    total: number;
	    version: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new DockerStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.stopped = source["stopped"];
	        this.total = source["total"];
	        this.version = source["version"];
	        this.error = source["error"];
	    }
	}
	export class GitHubStats {
	    username: string;
	    contributions: number;
	    commits: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new GitHubStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.username = source["username"];
	        this.contributions = source["contributions"];
	        this.commits = source["commits"];
	        this.error = source["error"];
	    }
	}
	export class AppData {
	    updated_at: string;
	    github: GitHubStats;
	    docker: DockerStats;
	    server: ServerStatus;
	
	    static createFrom(source: any = {}) {
	        return new AppData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.updated_at = source["updated_at"];
	        this.github = this.convertValues(source["github"], GitHubStats);
	        this.docker = this.convertValues(source["docker"], DockerStats);
	        this.server = this.convertValues(source["server"], ServerStatus);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ServerConfig {
	    id: string;
	    name: string;
	    ip: string;
	    port: number;
	    username: string;
	    auth_method: string;
	    password?: string;
	    private_key_path?: string;
	
	    static createFrom(source: any = {}) {
	        return new ServerConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.ip = source["ip"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.auth_method = source["auth_method"];
	        this.password = source["password"];
	        this.private_key_path = source["private_key_path"];
	    }
	}
	export class Config {
	    github_username: string;
	    github_token: string;
	    client_id: string;
	    server_host: string;
	    servers: ServerConfig[];
	    docker_socket: string;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.github_username = source["github_username"];
	        this.github_token = source["github_token"];
	        this.client_id = source["client_id"];
	        this.server_host = source["server_host"];
	        this.servers = this.convertValues(source["servers"], ServerConfig);
	        this.docker_socket = source["docker_socket"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ContainerInfo {
	    id: string;
	    name: string;
	    image: string;
	    state: string;
	    status: string;
	    cpu_usage: number;
	    mem_usage: number;
	    mem_percent: number;
	    network_rx: number;
	    network_tx: number;
	    io_read: number;
	    io_write: number;
	    pid_count: number;
	
	    static createFrom(source: any = {}) {
	        return new ContainerInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.image = source["image"];
	        this.state = source["state"];
	        this.status = source["status"];
	        this.cpu_usage = source["cpu_usage"];
	        this.mem_usage = source["mem_usage"];
	        this.mem_percent = source["mem_percent"];
	        this.network_rx = source["network_rx"];
	        this.network_tx = source["network_tx"];
	        this.io_read = source["io_read"];
	        this.io_write = source["io_write"];
	        this.pid_count = source["pid_count"];
	    }
	}
	
	
	
	export class ServerMetrics {
	    cpu_usage: number;
	    mem_total: number;
	    mem_used: number;
	    disk_total: number;
	    disk_used: number;
	    uptime: number;
	    load_avg: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ServerMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cpu_usage = source["cpu_usage"];
	        this.mem_total = source["mem_total"];
	        this.mem_used = source["mem_used"];
	        this.disk_total = source["disk_total"];
	        this.disk_used = source["disk_used"];
	        this.uptime = source["uptime"];
	        this.load_avg = source["load_avg"];
	        this.error = source["error"];
	    }
	}

}

