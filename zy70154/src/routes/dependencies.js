const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const router = express.Router();

router.get('/graph', async (req, res, next) => {
    try {
        const { service_id, depth } = req.query;
        const maxDepth = parseInt(depth) || 3;
        
        const servicesResult = await db.query('SELECT * FROM services');
        const dependenciesResult = await db.query(`
            SELECT d.*, 
                   us.service_name as upstream_name, 
                   ds.service_name as downstream_name
            FROM service_dependencies d
            JOIN services us ON d.upstream_service_id = us.service_id
            JOIN services ds ON d.downstream_service_id = ds.service_id
            WHERE d.is_active = true
        `);
        
        const services = servicesResult.rows;
        const dependencies = dependenciesResult.rows;
        
        let relevantServiceIds = null;
        if (service_id) {
            relevantServiceIds = new Set([service_id]);
            let added = true;
            let currentDepth = 0;
            
            while (added && currentDepth < maxDepth) {
                added = false;
                const newIds = new Set();
                
                dependencies.forEach(dep => {
                    if (relevantServiceIds.has(dep.upstream_service_id) && 
                        !relevantServiceIds.has(dep.downstream_service_id)) {
                        newIds.add(dep.downstream_service_id);
                        added = true;
                    }
                    if (relevantServiceIds.has(dep.downstream_service_id) && 
                        !relevantServiceIds.has(dep.upstream_service_id)) {
                        newIds.add(dep.upstream_service_id);
                        added = true;
                    }
                });
                
                newIds.forEach(id => relevantServiceIds.add(id));
                currentDepth++;
            }
        }
        
        const filteredServices = relevantServiceIds 
            ? services.filter(s => relevantServiceIds.has(s.service_id))
            : services;
            
        const filteredDependencies = relevantServiceIds
            ? dependencies.filter(d => 
                relevantServiceIds.has(d.upstream_service_id) && 
                relevantServiceIds.has(d.downstream_service_id))
            : dependencies;
        
        const nodes = filteredServices.map(s => ({
            id: s.service_id,
            label: s.service_name,
            version: s.current_version,
            owner: s.service_owner,
            status: s.status,
            group: 'service'
        }));
        
        const edges = filteredDependencies.map(d => ({
            id: d.dependency_id,
            from: d.upstream_service_id,
            to: d.downstream_service_id,
            fromLabel: d.upstream_name,
            toLabel: d.downstream_name,
            type: d.dependency_type,
            strength: d.dependency_strength,
            versionConstraint: {
                min: d.min_compatible_version,
                max: d.max_compatible_version
            }
        }));
        
        const stats = {
            totalServices: nodes.length,
            totalDependencies: edges.length,
            byType: edges.reduce((acc, e) => {
                acc[e.type] = (acc[e.type] || 0) + 1;
                return acc;
            }, {}),
            byStrength: edges.reduce((acc, e) => {
                acc[e.strength] = (acc[e.strength] || 0) + 1;
                return acc;
            }, {})
        };
        
        res.json({
            success: true,
            data: {
                nodes,
                edges,
                stats,
                filters: {
                    service_id: service_id || null,
                    depth: maxDepth
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const {
            upstream_service_id,
            downstream_service_id,
            dependency_type,
            min_compatible_version,
            max_compatible_version,
            dependency_strength
        } = req.body;
        
        if (!upstream_service_id || !downstream_service_id) {
            return res.status(400).json({
                success: false,
                error: 'upstream_service_id and downstream_service_id are required'
            });
        }
        
        if (upstream_service_id === downstream_service_id) {
            return res.status(400).json({
                success: false,
                error: 'A service cannot depend on itself'
            });
        }
        
        const dependencyId = uuidv4();
        
        const result = await db.query(`
            INSERT INTO service_dependencies 
            (dependency_id, upstream_service_id, downstream_service_id, 
             dependency_type, min_compatible_version, max_compatible_version, dependency_strength)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            dependencyId, 
            upstream_service_id, 
            downstream_service_id,
            dependency_type || 'DIRECT',
            min_compatible_version,
            max_compatible_version,
            dependency_strength || 'NORMAL'
        ]);
        
        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'Dependency already exists'
            });
        }
        next(error);
    }
});

router.put('/:dependencyId', async (req, res, next) => {
    try {
        const { dependencyId } = req.params;
        const {
            dependency_type,
            min_compatible_version,
            max_compatible_version,
            dependency_strength,
            is_active
        } = req.body;
        
        const result = await db.query(`
            UPDATE service_dependencies 
            SET dependency_type = COALESCE($1, dependency_type),
                min_compatible_version = COALESCE($2, min_compatible_version),
                max_compatible_version = COALESCE($3, max_compatible_version),
                dependency_strength = COALESCE($4, dependency_strength),
                is_active = COALESCE($5, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE dependency_id = $6
            RETURNING *
        `, [dependency_type, min_compatible_version, max_compatible_version, 
            dependency_strength, is_active, dependencyId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Dependency not found'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

router.delete('/:dependencyId', async (req, res, next) => {
    try {
        const { dependencyId } = req.params;
        
        const result = await db.query(
            'UPDATE service_dependencies SET is_active = false WHERE dependency_id = $1 RETURNING *',
            [dependencyId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Dependency not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Dependency deactivated',
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
