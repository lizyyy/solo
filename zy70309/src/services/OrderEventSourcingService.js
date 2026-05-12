const eventRepository = require('../repositories/EventRepository');
const projectionRepository = require('../repositories/ProjectionRepository');
const ruleEngine = require('./RuleEngine');
const { StateMachine, ORDER_STATES, EVENT_TYPES } = require('./StateMachine');
const { generateEventId } = require('../utils/idGenerator');
const { AppError } = require('../utils/errorHandler');

class OrderEventSourcingService {
  constructor() {
    this.stateMachine = new StateMachine();
  }

  async appendEvent(orderId, eventData, autoProject = true) {
    const existingProjection = await projectionRepository.findByOrderId(orderId);
    const latestVersion = await eventRepository.getLatestEventVersion(orderId);

    let currentState = null;
    if (existingProjection) {
      currentState = existingProjection.currentState;
    }

    const validationResult = await ruleEngine.validateEvent(
      eventData,
      currentState,
      latestVersion
    );

    if (validationResult.isIdempotent && validationResult.existingEvent) {
      return {
        success: true,
        isIdempotent: true,
        event: validationResult.existingEvent,
        message: '事件已存在，幂等处理'
      };
    }

    const eventId = eventData.eventId || generateEventId();
    const eventVersion = eventData.eventVersion || (latestVersion + 1);

    const event = {
      orderId,
      eventId,
      eventType: eventData.eventType,
      eventVersion,
      timestamp: eventData.timestamp || new Date(),
      payload: eventData.payload,
      metadata: eventData.metadata || {},
      isCompensation: eventData.isCompensation || false,
      compensatesEventId: eventData.compensatesEventId || null,
      isValid: validationResult.isValid,
      validationErrors: validationResult.errors,
      isProcessed: false
    };

    if (!validationResult.isValid) {
      await eventRepository.saveEvent(event);
      throw new AppError(
        `事件验证失败: ${validationResult.errors.join('; ')}`,
        400,
        'EVENT_VALIDATION_FAILED'
      );
    }

    const savedEvent = await eventRepository.saveEvent(event);

    let projection = existingProjection;
    if (autoProject && validationResult.isValid) {
      projection = await this.projectEvent(savedEvent, existingProjection);
    }

    return {
      success: true,
      event: savedEvent,
      projection,
      warnings: validationResult.warnings,
      description: this.stateMachine.getTransitionDescription(
        currentState || ORDER_STATES.CREATED,
        eventData.eventType
      )
    };
  }

  async projectEvent(event, existingProjection) {
    let projection;
    
    if (existingProjection) {
      projection = JSON.parse(JSON.stringify(existingProjection));
    } else {
      projection = {
        orderId: event.orderId,
        currentState: ORDER_STATES.CREATED,
        version: 0,
        lastEventId: '',
        lastEventTimestamp: new Date(0),
        orderDetails: {},
        paymentInfo: {},
        inventoryInfo: { locked: false, items: [] },
        shippingInfo: {},
        cancellationInfo: { requested: false },
        refundInfo: {},
        compensationInfo: { isCompensated: false, events: [] },
        stateHistory: [],
        isConsistent: true,
        inconsistencyDetails: []
      };
    }

    if (!event.isValid) {
      projection.isConsistent = false;
      if (!projection.inconsistencyDetails) {
        projection.inconsistencyDetails = [];
      }
      projection.inconsistencyDetails.push(
        `检测到非法事件: ${event.eventId}, 类型: ${event.eventType}`
      );
      return await projectionRepository.save(projection);
    }

    const newProjection = ruleEngine.applyEvent(projection, event, this.stateMachine);
    newProjection.version++;
    newProjection.lastEventId = event.eventId;
    newProjection.lastEventTimestamp = event.timestamp;

    const { EVENT_TO_STATE_MAPPING } = require('./StateMachine');
    const newState = EVENT_TO_STATE_MAPPING[event.eventType];

    if (newState && event.eventType !== EVENT_TYPES.ORDER_CREATED) {
      const description = this.stateMachine.getTransitionDescription(
        projection.currentState,
        event.eventType
      );

      newProjection.stateHistory.push({
        state: newState,
        eventId: event.eventId,
        timestamp: event.timestamp,
        description: description || this.stateMachine.getEventDescription(event.eventType)
      });
    }

    if (event.eventType === EVENT_TYPES.ORDER_CREATED) {
      newProjection.currentState = ORDER_STATES.CREATED;
    } else {
      newProjection.currentState = newState || newProjection.currentState;
    }

    await eventRepository.markEventAsProcessed(event.eventId);
    return await projectionRepository.save(newProjection);
  }

  async getOrderTimeline(orderId, options = {}) {
    const events = await eventRepository.findEventsByOrderId(orderId, options);
    const projection = await projectionRepository.findByOrderId(orderId);

    if (events.length === 0) {
      throw new AppError(`订单 ${orderId} 不存在`, 404, 'ORDER_NOT_FOUND');
    }

    const timeline = {
      orderId,
      currentState: projection ? projection.currentState : null,
      currentStateDescription: projection ? 
        this.stateMachine.getStateDescription(projection.currentState) : null,
      totalEvents: events.length,
      validEvents: events.filter(e => e.isValid).length,
      invalidEvents: events.filter(e => !e.isValid).length,
      events: events.map(event => ({
        eventId: event.eventId,
        eventVersion: event.eventVersion,
        eventType: event.eventType,
        eventTypeDescription: this.stateMachine.getEventDescription(event.eventType),
        timestamp: event.timestamp,
        payload: event.payload,
        metadata: event.metadata,
        isCompensation: event.isCompensation,
        compensatesEventId: event.compensatesEventId,
        isValid: event.isValid,
        validationErrors: event.validationErrors,
        isProcessed: event.isProcessed
      })),
      stateTransitions: []
    };

    let currentState = null;
    for (const event of events.filter(e => e.isValid)) {
      const { EVENT_TO_STATE_MAPPING } = require('./StateMachine');
      const newState = EVENT_TO_STATE_MAPPING[event.eventType];
      
      if (newState) {
        const transition = {
          fromState: currentState,
          fromStateDescription: currentState ? 
            this.stateMachine.getStateDescription(currentState) : null,
          toState: newState,
          toStateDescription: this.stateMachine.getStateDescription(newState),
          eventId: event.eventId,
          eventType: event.eventType,
          timestamp: event.timestamp,
          description: currentState ? 
            this.stateMachine.getTransitionDescription(currentState, event.eventType) : 
            '订单创建'
        };
        timeline.stateTransitions.push(transition);
        currentState = newState;
      }
    }

    return timeline;
  }

  async replayToPoint(orderId, replayOptions) {
    let events;

    if (replayOptions.toVersion !== undefined) {
      events = await eventRepository.getEventsUpToVersion(orderId, replayOptions.toVersion);
    } else if (replayOptions.toEventId) {
      events = await eventRepository.getEventsUpToEventId(orderId, replayOptions.toEventId);
    } else if (replayOptions.toTime) {
      const allEvents = await eventRepository.findEventsByOrderId(orderId);
      events = allEvents.filter(e => new Date(e.timestamp) <= new Date(replayOptions.toTime));
    } else {
      events = await eventRepository.findEventsByOrderId(orderId);
    }

    if (events.length === 0) {
      throw new AppError(`订单 ${orderId} 不存在`, 404, 'ORDER_NOT_FOUND');
    }

    const replayedProjection = await ruleEngine.replayEvents(events.filter(e => e.isValid));
    const finalEvent = events[events.length - 1];

    return {
      orderId,
      replayedTo: {
        version: replayOptions.toVersion || finalEvent.eventVersion,
        eventId: replayOptions.toEventId || finalEvent.eventId,
        time: replayOptions.toTime || finalEvent.timestamp
      },
      stateAtPoint: replayedProjection.currentState,
      stateDescription: this.stateMachine.getStateDescription(replayedProjection.currentState),
      orderDetails: replayedProjection.orderDetails,
      paymentInfo: replayedProjection.paymentInfo,
      inventoryInfo: replayedProjection.inventoryInfo,
      shippingInfo: replayedProjection.shippingInfo,
      cancellationInfo: replayedProjection.cancellationInfo,
      refundInfo: replayedProjection.refundInfo,
      stateHistory: replayedProjection.stateHistory.map(h => ({
        ...h,
        stateDescription: this.stateMachine.getStateDescription(h.state)
      })),
      eventsReplayed: events.map(event => ({
        eventId: event.eventId,
        eventVersion: event.eventVersion,
        eventType: event.eventType,
        eventTypeDescription: this.stateMachine.getEventDescription(event.eventType),
        timestamp: event.timestamp,
        isValid: event.isValid,
        validationErrors: event.validationErrors
      }))
    };
  }

  async rebuildProjection(orderId) {
    const events = await eventRepository.findEventsByOrderId(orderId);
    
    if (events.length === 0) {
      throw new AppError(`订单 ${orderId} 不存在`, 404, 'ORDER_NOT_FOUND');
    }

    const validEvents = events.filter(e => e.isValid);
    const replayedProjection = await ruleEngine.replayEvents(validEvents);

    const latestEvent = validEvents[validEvents.length - 1];

    const projection = {
      orderId,
      currentState: replayedProjection.currentState,
      version: replayedProjection.version,
      lastEventId: latestEvent.eventId,
      lastEventTimestamp: latestEvent.timestamp,
      orderDetails: replayedProjection.orderDetails,
      paymentInfo: replayedProjection.paymentInfo,
      inventoryInfo: replayedProjection.inventoryInfo,
      shippingInfo: replayedProjection.shippingInfo,
      cancellationInfo: replayedProjection.cancellationInfo,
      refundInfo: replayedProjection.refundInfo,
      compensationInfo: replayedProjection.compensationInfo,
      stateHistory: replayedProjection.stateHistory,
      isConsistent: true,
      inconsistencyDetails: []
    };

    const consistencyCheck = await ruleEngine.checkConsistency(orderId, projection);
    if (!consistencyCheck.isConsistent) {
      projection.isConsistent = false;
      projection.inconsistencyDetails = consistencyCheck.inconsistencyDetails;
    }

    const savedProjection = await projectionRepository.save(projection);

    return {
      success: true,
      message: '投影重建完成',
      projection: savedProjection,
      eventsProcessed: validEvents.length,
      invalidEvents: events.length - validEvents.length,
      isConsistent: savedProjection.isConsistent,
      inconsistencyDetails: savedProjection.inconsistencyDetails
    };
  }

  async checkConsistency(orderId) {
    const projection = await projectionRepository.findByOrderId(orderId);
    
    if (!projection) {
      throw new AppError(`订单 ${orderId} 的投影不存在`, 404, 'PROJECTION_NOT_FOUND');
    }

    return await ruleEngine.checkConsistency(orderId, projection);
  }

  async getProjection(orderId) {
    const projection = await projectionRepository.findByOrderId(orderId);
    
    if (!projection) {
      throw new AppError(`订单 ${orderId} 的投影不存在`, 404, 'PROJECTION_NOT_FOUND');
    }

    return {
      ...projection.toObject(),
      currentStateDescription: this.stateMachine.getStateDescription(projection.currentState),
      stateHistory: projection.stateHistory.map(h => ({
        ...h,
        stateDescription: this.stateMachine.getStateDescription(h.state)
      }))
    };
  }
}

module.exports = new OrderEventSourcingService();
