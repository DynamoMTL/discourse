# See http://unicorn.bogomips.org/Unicorn/Configurator.html

# enable out of band gc out of the box, it is low risk and improves perf a lot
ENV['UNICORN_ENABLE_OOBGC'] = "1"

discourse_path = File.expand_path(File.expand_path(File.dirname(__FILE__)) + "/../")

# tune down if not enough ram
worker_processes 2

working_directory "#{ENV['STACK_PATH']}"

# listen "#{discourse_path}/tmp/sockets/unicorn.sock"
listen "/tmp/web_server.sock", :backlog => 64

# nuke workers after 30 seconds instead of 60 seconds (the default)
timeout 30

# feel free to point this anywhere accessible on the filesystem
pid '/tmp/web_server.pid'

# By default, the Unicorn logger will write to stderr.
# Additionally, some applications/frameworks log to stderr or stdout,
# so prevent them from going to /dev/null when daemonized here:
stderr_path "#{ENV['STACK_PATH']}/log/unicorn.stderr.log"
stdout_path "#{ENV['STACK_PATH']}/log/unicorn.stdout.log"

GC.respond_to?(:copy_on_write_friendly=) and
    GC.copy_on_write_friendly = true

# important for Ruby 2.0
preload_app true

# Enable this flag to have unicorn test client connections by writing the
# beginning of the HTTP headers before calling the application.  This
# prevents calling the application for connections that have disconnected
# while queued.  This is only guaranteed to detect clients on the same
# host unicorn runs on, and unlikely to detect disconnects even on a
# fast LAN.
check_client_connection false

initialized = false
before_fork do |server, worker|

  unless initialized
    old_pid = '/tmp/web_server.pid.oldbin'
    if File.exists?(old_pid) && server.pid != old_pid
      begin
        Process.kill("QUIT", File.read(old_pid).to_i)
      rescue Errno::ENOENT, Errno::ESRCH
        # someone else did our job for us
      end
    end

    # load up the yaml for the localization bits, in master process
    I18n.t(:posts)

    # load up all models and schema
    (ActiveRecord::Base.connection.tables - %w[schema_migrations]).each do |table|
      table.classify.constantize.first rescue nil
    end

    # router warm up
    Rails.application.routes.recognize_path('abc') rescue nil

    # get rid of rubbish so we don't share it
    GC.start

    initialized = true

    supervisor = ENV['UNICORN_SUPERVISOR_PID'].to_i
    if supervisor > 0
      Thread.new do
        while true
          unless File.exists?("/proc/#{supervisor}")
            puts "Kill self supervisor is gone"
            Process.kill "TERM", Process.pid
          end
          sleep 2
        end
      end
    end

  end

  defined?(ActiveRecord::Base) and
  ActiveRecord::Base.connection.disconnect!
  $redis.client.disconnect


  # Throttle the master from forking too quickly by sleeping.  Due
  # to the implementation of standard Unix signal handlers, this
  # helps (but does not completely) prevent identical, repeated signals
  # from being lost when the receiving process is busy.
  sleep 1
end

after_fork do |server, worker|
  defined?(ActiveRecord::Base) and
      ActiveRecord::Base.establish_connection
  $redis.client.reconnect
  Rails.cache.reconnect
  MessageBus.after_fork
end