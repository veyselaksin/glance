export namespace main {
	
	export class Config {
	    github_username: string;
	    github_token: string;
	    client_id: string;
	    client_secret: string;
	    server_host: string;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.github_username = source["github_username"];
	        this.github_token = source["github_token"];
	        this.client_id = source["client_id"];
	        this.client_secret = source["client_secret"];
	        this.server_host = source["server_host"];
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
	export class WidgetData {
	    updated_at: string;
	    github: GitHubStats;
	    docker: DockerStats;
	    server: ServerStatus;
	
	    static createFrom(source: any = {}) {
	        return new WidgetData(source);
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

}

