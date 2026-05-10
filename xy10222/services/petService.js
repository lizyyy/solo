const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');

class PetService {
  createPet(petData) {
    const existingPet = store.getPetByName(petData.name);
    if (existingPet) {
      throw new Error(`已存在名为 "${petData.name}" 的宠物档案`);
    }

    const pet = {
      id: uuidv4(),
      ...petData,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return store.addPet(pet);
  }

  getPetById(petId) {
    return store.getPetById(petId);
  }

  getAllPets() {
    return store.getAllPets();
  }

  updatePet(petId, updates) {
    const existingPet = store.getPetById(petId);
    if (!existingPet) {
      throw new Error(`找不到 ID 为 "${petId}" 的宠物`);
    }

    if (updates.name && updates.name !== existingPet.name) {
      const existingPetWithName = store.getPetByName(updates.name);
      if (existingPetWithName) {
        throw new Error(`已存在名为 "${updates.name}" 的宠物档案`);
      }
    }

    return store.updatePet(petId, updates);
  }
}

module.exports = new PetService();
