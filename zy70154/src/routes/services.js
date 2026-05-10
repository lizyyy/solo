const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const { status, service_name } = req.query;
        
        let query = 'SELECT * FROM services WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        if (service_name) {
            query += ` AND service_name ILIKE $${paramIndex++}`;
            params.push(`%${service_name}%`);
        }
        query += ' ORDER BY created_at DESC';
        
        const result = await db.query(query, params);
        
        res.json({
            success: true,
            data: {
                services: result.rows,
                total: result.rows.length
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:serviceId', async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        
        const serviceResult = await db.query(
            'SELECT * FROM services WHERE service_id = $1',
            [serviceId]
        );
        
        if (serviceResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Service not found'
            });
        }
        
        const upstreamResult = await db.query(`
            SELECT d.*, s.service_name as downstream_name
            FROM service_dependencies d
            JOIN services s ON d.downstream_service_id = s.service_id
            WHERE d.upstream_service_id = $1 AND d.is_active = true
        `, [serviceId]);
        
        const downstreamResult = await db.query(`
            SELECT d.*, s.service_name as upstream_name
            FROM service_dependencies d
            JOIN services s ON d.upstream_service_id = s.service_id
            WHERE d.downstream_service_id = $1 AND d.is_active = true
        `, [serviceId]);
        
        res.json({
            success: true,
            data: {
                service: serviceResult.rows[0],
                dependents: upstreamResult.rows,
                dependencies: downstreamResult.rows
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const {
            service_id,
            service_name,
            service_owner,
            owner_email,
            current_version,
            description
        } = req.body;
        
        if (!service_name) {
            return res.status(400).json({
                success: false,
                error: 'service_name is required'
            });
        }
        
        const newServiceId = service_id || uuidv4();
        
        const result = await db.query(`
            INSERT INTO services 
            (service_id, service_name, service_owner, owner_email, current_version, description)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [newServiceId, service_name, service_owner, owner_email, current_version, description]);
        
        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

router.put('/:serviceId', async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const {
            service_name,
            service_owner,
            owner_email,
            current_version,
            description,
            status
        } = req.body;
        
        const result = await db.query(`
            UPDATE services 
            SET service_name = COALESCE($1, service_name),
                service_owner = COALESCE($2, service_owner),
                owner_email = COALESCE($3, owner_email),
                current_version = COALESCE($4, current_version),
                description = COALESCE($5, description),
                status = COALESCE($6, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE service_id = $7
            RETURNING *
        `, [service_name, service_owner, owner_email, current_version, description, status, serviceId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Service not found'
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

module.exports = router;
