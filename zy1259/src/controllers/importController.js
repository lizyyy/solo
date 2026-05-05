const importService = require('../services/importService');

class ImportController {
  async importProducers(req, res) {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
      }

      const result = await importService.importProducers(filePath);
      res.json({
        success: true,
        message: `Successfully imported ${result.count} producers`,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async importTopics(req, res) {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
      }

      const result = await importService.importTopics(filePath);
      res.json({
        success: true,
        message: `Successfully imported ${result.count} topics`,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async importMessages(req, res) {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
      }

      const result = await importService.importMessages(filePath);
      res.json({
        success: true,
        message: `Successfully imported ${result.count} messages`,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async importDeliveryEvents(req, res) {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
      }

      const result = await importService.importDeliveryEvents(filePath);
      res.json({
        success: true,
        message: `Successfully imported ${result.count} delivery events`,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async importAll(req, res) {
    try {
      const { producersPath, topicsPath, messagesPath, deliveryEventsPath, directory } = req.body;

      let result;
      if (directory) {
        result = await importService.importFromDirectory(directory);
      } else {
        result = await importService.importAll(
          producersPath,
          topicsPath,
          messagesPath,
          deliveryEventsPath
        );
      }

      const importedCount = [
        result.producers?.count || 0,
        result.topics?.count || 0,
        result.messages?.count || 0,
        result.deliveryEvents?.count || 0
      ].reduce((a, b) => a + b, 0);

      if (result.errors.length > 0) {
        return res.status(207).json({
          success: true,
          message: `Imported ${importedCount} items with ${result.errors.length} errors`,
          data: result
        });
      }

      res.json({
        success: true,
        message: `Successfully imported ${importedCount} items`,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new ImportController();
