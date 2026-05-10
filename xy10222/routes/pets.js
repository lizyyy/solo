const express = require('express');
const router = express.Router();
const petService = require('../services/petService');
const store = require('../data/store');

router.post('/', (req, res) => {
  const requestId = req.headers['x-request-id'];
  
  if (requestId) {
    const idempotentResponse = store.checkIdempotency(requestId);
    if (idempotentResponse) {
      return res.status(idempotentResponse.status).json(idempotentResponse.body);
    }
  }

  try {
    if (!req.body.name) {
      throw new Error('缺少必填字段：宠物名称');
    }
    if (!req.body.species) {
      throw new Error('缺少必填字段：宠物种类');
    }
    if (!req.body.breed) {
      throw new Error('缺少必填字段：宠物品种');
    }
    if (!req.body.age) {
      throw new Error('缺少必填字段：宠物年龄');
    }
    if (!req.body.weight) {
      throw new Error('缺少必填字段：宠物体重');
    }

    const pet = petService.createPet(req.body);
    
    const response = {
      status: 201,
      body: {
        message: '宠物档案创建成功',
        pet
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.status(201).json(response.body);
  } catch (error) {
    const response = {
      status: 400,
      body: {
        error: '创建宠物档案失败',
        message: error.message
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.status(400).json(response.body);
  }
});

router.get('/:petId', (req, res) => {
  try {
    const pet = petService.getPetById(req.params.petId);
    if (!pet) {
      return res.status(404).json({
        error: '未找到宠物',
        message: `找不到 ID 为 "${req.params.petId}" 的宠物`
      });
    }
    res.json(pet);
  } catch (error) {
    res.status(400).json({
      error: '查询宠物档案失败',
      message: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const pets = petService.getAllPets();
    res.json({
      count: pets.length,
      pets
    });
  } catch (error) {
    res.status(400).json({
      error: '查询宠物列表失败',
      message: error.message
    });
  }
});

router.put('/:petId', (req, res) => {
  try {
    const pet = petService.updatePet(req.params.petId, req.body);
    res.json({
      message: '宠物档案更新成功',
      pet
    });
  } catch (error) {
    res.status(400).json({
      error: '更新宠物档案失败',
      message: error.message
    });
  }
});

module.exports = router;
