const amqp = require('amqplib');

class MessageQueueService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.queues = new Map();
    this.isConnected = false;
  }

  async initialize() {
    try {
      console.log('🔄 Initializing RabbitMQ connection...');
      
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      
      // Set up error handling
      this.connection.on('error', (err) => {
        console.error('❌ RabbitMQ connection error:', err.message);
        this.isConnected = false;
      });
      
      this.connection.on('close', () => {
        console.log('⚠️ RabbitMQ connection closed');
        this.isConnected = false;
      });
      
      this.isConnected = true;
      console.log('✅ RabbitMQ connection successful');
      
      // Create default queues
      await this.createQueues();
      
      return true;
    } catch (error) {
      console.log('⚠️ RabbitMQ not available, using in-memory queue');
      console.log('📝 To enable RabbitMQ, set RABBITMQ_URL environment variable');
      console.log('   Example: RABBITMQ_URL=amqp://localhost:5672');
      this.isConnected = false;
      return false;
    }
  }

  async createQueues() {
    if (!this.channel) return;

    const queueConfigs = [
      { name: 'line.messages.incoming', durable: true },
      { name: 'line.messages.outgoing', durable: true },
      { name: 'line.events', durable: true },
      { name: 'whatsapp.messages.incoming', durable: true },
      { name: 'whatsapp.messages.outgoing', durable: true },
      { name: 'telegram.messages.incoming', durable: true },
      { name: 'telegram.messages.outgoing', durable: true },
      { name: 'facebook.messages.incoming', durable: true },
      { name: 'facebook.messages.outgoing', durable: true },
      { name: 'omni.notifications', durable: true },
      { name: 'omni.user.presence', durable: true },
      { name: 'omni.typing.indicators', durable: true }
    ];

    for (const config of queueConfigs) {
      await this.channel.assertQueue(config.name, { durable: config.durable });
      this.queues.set(config.name, config);
    }

    console.log(`✅ Created ${queueConfigs.length} queues`);
  }

  async publishMessage(queueName, message, options = {}) {
    if (!this.isConnected || !this.channel) {
      // Fallback to in-memory processing
      console.log(`⚠️ RabbitMQ not available, processing ${queueName} in-memory`);
      return this.processMessageInMemory(queueName, message);
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      const published = this.channel.publish('', queueName, messageBuffer, {
        persistent: true,
        ...options
      });

      if (published) {
        console.log(`📨 Published message to ${queueName}`);
        return true;
      } else {
        console.log(`⚠️ Failed to publish message to ${queueName}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error publishing to ${queueName}:`, error.message);
      return false;
    }
  }

  async consumeMessages(queueName, callback, options = {}) {
    if (!this.isConnected || !this.channel) {
      console.log(`⚠️ RabbitMQ not available, cannot consume from ${queueName}`);
      return;
    }

    try {
      await this.channel.consume(queueName, async (msg) => {
        if (msg) {
          try {
            const message = JSON.parse(msg.content.toString());
            await callback(message);
            this.channel.ack(msg);
          } catch (error) {
            console.error(`❌ Error processing message from ${queueName}:`, error.message);
            this.channel.nack(msg, false, false);
          }
        }
      }, { noAck: false, ...options });

      console.log(`📥 Started consuming messages from ${queueName}`);
    } catch (error) {
      console.error(`❌ Error consuming from ${queueName}:`, error.message);
    }
  }

  async processMessageInMemory(queueName, message) {
    // In-memory message processing fallback
    console.log(`🔄 Processing ${queueName} in-memory:`, message);
    
    // Simulate message processing
    switch (queueName) {
      case 'line.messages.incoming':
        return await this.processLineIncomingMessage(message);
      case 'line.messages.outgoing':
        return await this.processLineOutgoingMessage(message);
      case 'omni.notifications':
        return await this.processNotification(message);
      default:
        console.log(`⚠️ Unknown queue: ${queueName}`);
        return false;
    }
  }

  async processLineIncomingMessage(message) {
    console.log('📱 Processing LINE incoming message in-memory');
    // This would integrate with the existing LINE webhook handler
    return true;
  }

  async processLineOutgoingMessage(message) {
    console.log('📤 Processing LINE outgoing message in-memory');
    // This would integrate with the existing LINE API sender
    return true;
  }

  async processNotification(message) {
    console.log('🔔 Processing notification in-memory');
    // This would integrate with Socket.IO for real-time notifications
    return true;
  }

  async getQueueStatus() {
    if (!this.isConnected || !this.channel) {
      return {
        connected: false,
        queues: Array.from(this.queues.keys()),
        message: 'RabbitMQ not available, using in-memory queue'
      };
    }

    const status = {
      connected: true,
      queues: {},
      message: 'RabbitMQ connected and operational'
    };

    for (const [queueName] of this.queues) {
      try {
        const queueInfo = await this.channel.checkQueue(queueName);
        status.queues[queueName] = {
          messageCount: queueInfo.messageCount,
          consumerCount: queueInfo.consumerCount
        };
      } catch (error) {
        status.queues[queueName] = { error: error.message };
      }
    }

    return status;
  }

  async close() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    this.isConnected = false;
    console.log('✅ RabbitMQ connection closed');
  }
}

module.exports = MessageQueueService;