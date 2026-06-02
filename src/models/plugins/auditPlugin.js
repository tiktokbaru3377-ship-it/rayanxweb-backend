const { auditQueue } = require('../../queues/bull.queue');
const logger = require('../../utils/logger');

module.exports = function auditPlugin(schema, options) {
  // Ambil nama model dari opsi atau deteksi otomatis
  const modelName = options?.modelName || 'UnknownModel';

  // Hook setelah data berhasil diperbarui (Update)
  schema.post('findOneAndUpdate', async function (doc) {
    if (!doc) return;
    try {
      const updateData = this.getUpdate();
      
      await auditQueue.add('logAudit', {
        userId: updateData?.$userId || 'SYSTEM_AUTOMATION',
        action: `${modelName.toUpperCase()}_MUTATION_UPDATE`,
        targetId: doc._id.toString(),
        details: {
          before: doc._original || 'Not Captured',
          after: updateData
        }
      });
    } catch (error) {
      logger.error(`[Audit Plugin Error] Failed to queue update log: ${error.message}`);
    }
  });

  // Hook sebelum data diperbarui untuk menangkap state asli (Pre-fetch state)
  schema.pre('findOneAndUpdate', async function () {
    try {
      const docToUpdate = await this.model.findOne(this.getQuery());
      if (docToUpdate) {
        this._update._original = docToUpdate.toObject();
      }
    } catch (err) {
      logger.error(`[Audit Plugin Error] Pre-update capture failed: ${err.message}`);
    }
  });

  // Hook setelah data dihapus (Delete)
  schema.post('findOneAndDelete', async function (doc) {
    if (!doc) return;
    try {
      await auditQueue.add('logAudit', {
        userId: 'SYSTEM_ADMIN_FORCE',
        action: `${modelName.toUpperCase()}_MUTATION_DELETE`,
        targetId: doc._id.toString(),
        details: { deletedData: doc.toObject() }
      });
    } catch (error) {
      logger.error(`[Audit Plugin Error] Failed to queue delete log: ${error.message}`);
    }
  });
};
