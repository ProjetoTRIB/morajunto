// PM2 — Process Manager config
module.exports = {
    apps: [{
        name: 'morajunto',
        script: 'server.js',
        instances: 1,
        exec_mode: 'fork',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        max_memory_restart: '300M',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        error_file: '/var/log/morajunto/error.log',
        out_file: '/var/log/morajunto/out.log',
        merge_logs: true,
        restart_delay: 5000,
        max_restarts: 10,
        watch: false
    }]
};
