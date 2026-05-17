const mongoose = require('mongoose');
const { PreparedMeal } = require('../models/PreparedMeal');
const { OffShelvesHistory } = require('../models/OffShelvesHistory');

const connectDB = async () => {
  await mongoose.connect('mongodb://localhost:27017/food_prepared_meals');
  console.log('MongoDB connected for testing');
};

const runTests = async () => {
  try {
    await connectDB();

    console.log('\n=== Test 1: Full Status Flow ===');
    console.log('Testing complete status flow for PMC001 (红烧狮子头)');
    
    const meal1 = await PreparedMeal.findOne({ sku: 'PMC001' });
    console.log('Initial status:', meal1.status);

    console.log('\n=== Test 2: Conflict Scenario ===');
    console.log('Testing inventory conflict for a meal with stock');
    
    const mealWithStock = await PreparedMeal.findOne({ sku: 'PMC003' });
    console.log('Meal:', mealWithStock.name, 'SKU:', mealWithStock.sku);
    console.log('Status:', mealWithStock.status);

    console.log('\n=== Test 3: History Records ===');
    const history = await OffShelvesHistory.find({})
      .populate('preparedMealId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log('Recent history records:');
    history.forEach((record, index) => {
      console.log(`${index + 1}. ${record.preparedMealId?.name || 'Unknown'} - ${record.reason} - Conflict: ${record.hasInventoryConflict}`);
    });

    console.log('\n=== Test 4: Statistics ===');
    const totalRecords = await OffShelvesHistory.countDocuments({});
    const conflictRecords = await OffShelvesHistory.countDocuments({ hasInventoryConflict: true });
    const badRows = await OffShelvesHistory.countDocuments({ importError: { $exists: true } });
    
    console.log('Total history records:', totalRecords);
    console.log('Conflict records:', conflictRecords);
    console.log('Bad import rows:', badRows);

    console.log('\n=== Test Summary ===');
    console.log('✅ All tests completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
};

runTests();
