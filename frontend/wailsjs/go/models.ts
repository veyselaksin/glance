export namespace api {
	
	export class Server {
	    id: string;
	    name: string;
	    ip: string;
	    port: number;
	    username: string;
	    auth_method: string;
	    private_key_path?: string;
	    has_password: boolean;
	    password?: string;
	
	    static createFrom(source: any = {}) {
	        return new Server(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.ip = source["ip"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.auth_method = source["auth_method"];
	        this.private_key_path = source["private_key_path"];
	        this.has_password = source["has_password"];
	        this.password = source["password"];
	    }
	}
	export class Settings {
	    github_username: string;
	    github_connected: boolean;
	    client_id: string;
	    server_host: string;
	    docker_socket: string;
	    theme: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.github_username = source["github_username"];
	        this.github_connected = source["github_connected"];
	        this.client_id = source["client_id"];
	        this.server_host = source["server_host"];
	        this.docker_socket = source["docker_socket"];
	        this.theme = source["theme"];
	    }
	}

}

export namespace docker {
	
	export class Container {
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
	        return new Container(source);
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
	export class Summary {
	    running: number;
	    stopped: number;
	    total: number;
	    version: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new Summary(source);
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

}

export namespace github {
	
	export class Commit {
	    sha: string;
	    message: string;
	    repo: string;
	    branch: string;
	    url: string;
	    date: string;
	
	    static createFrom(source: any = {}) {
	        return new Commit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sha = source["sha"];
	        this.message = source["message"];
	        this.repo = source["repo"];
	        this.branch = source["branch"];
	        this.url = source["url"];
	        this.date = source["date"];
	    }
	}
	export class RepoActivity {
	    repo: string;
	    url: string;
	    commits: number;
	
	    static createFrom(source: any = {}) {
	        return new RepoActivity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.repo = source["repo"];
	        this.url = source["url"];
	        this.commits = source["commits"];
	    }
	}
	export class Activity {
	    days: number;
	    since: string;
	    total: number;
	    repos: RepoActivity[];
	    commits: Commit[];
	    partial: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Activity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.days = source["days"];
	        this.since = source["since"];
	        this.total = source["total"];
	        this.repos = this.convertValues(source["repos"], RepoActivity);
	        this.commits = this.convertValues(source["commits"], Commit);
	        this.partial = source["partial"];
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
	
	
	export class Stats {
	    username: string;
	    contributions: number;
	    commits: number;
	    error?: string;
	    warning?: string;
	
	    static createFrom(source: any = {}) {
	        return new Stats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.username = source["username"];
	        this.contributions = source["contributions"];
	        this.commits = source["commits"];
	        this.error = source["error"];
	        this.warning = source["warning"];
	    }
	}

}

export namespace netcheck {
	
	export class Status {
	    host: string;
	    online: boolean;
	    latency: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.online = source["online"];
	        this.latency = source["latency"];
	        this.error = source["error"];
	    }
	}

}

export namespace poller {
	
	export class Snapshot {
	    updated_at: string;
	    github: github.Stats;
	    docker: docker.Summary;
	    server: netcheck.Status;
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.updated_at = source["updated_at"];
	        this.github = this.convertValues(source["github"], github.Stats);
	        this.docker = this.convertValues(source["docker"], docker.Summary);
	        this.server = this.convertValues(source["server"], netcheck.Status);
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

}

export namespace sshx {
	
	export class Metrics {
	    cpu_usage: number;
	    mem_total: number;
	    mem_used: number;
	    disk_total: number;
	    disk_used: number;
	    uptime: number;
	    load_avg: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new Metrics(source);
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

