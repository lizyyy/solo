const { v4: uuidv4 } = require('uuid');

const STATUS = {
  REPORTED: 'reported',
  DISPATCHED: 'dispatched',
  ON_SITE: 'on_site',
  RESCUED: 'rescued',
  CLOSED: 'closed'
};

const tickets = [];
const DUPLICATE_WINDOW_MINUTES = 30;

function getCurrentTime() {
  return new Date().toISOString();
}

function createTicket(data) {
  const { building, elevator, reporterName, reporterPhone, trappedCount, description } = data;
  
  const existingTicket = findOpenTicketForElevator(building, elevator);
  if (existingTicket) {
    return { 
      merged: true, 
      originalTicketId: existingTicket.id,
      ticket: existingTicket
    };
  }

  const ticket = {
    id: uuidv4(),
    building,
    elevator,
    reporterName,
    reporterPhone,
    trappedCount: parseInt(trappedCount) || 1,
    description: description || '',
    status: STATUS.REPORTED,
    reportedAt: getCurrentTime(),
    dispatchedAt: null,
    maintenancePerson: null,
    arrivedAt: null,
    rescuedAt: null,
    closedAt: null,
    review: null,
    mergeCount: 0,
    mergedFrom: []
  };

  tickets.push(ticket);
  return { merged: false, ticket };
}

function findOpenTicketForElevator(building, elevator) {
  const now = Date.now();
  return tickets.find(t => {
    if (t.status === STATUS.CLOSED) return false;
    const reportedTime = new Date(t.reportedAt).getTime();
    const withinWindow = (now - reportedTime) < (DUPLICATE_WINDOW_MINUTES * 60 * 1000);
    return t.building === building && t.elevator === elevator && withinWindow;
  });
}

function getTicketById(id) {
  return tickets.find(t => t.id === id);
}

function getAllTickets() {
  return [...tickets];
}

function dispatchTicket(id, maintenancePerson) {
  const ticket = getTicketById(id);
  if (!ticket) return null;
  
  if (ticket.status !== STATUS.REPORTED) {
    return { error: '只能对已报警未派单的工单进行派单' };
  }
  if (ticket.status === STATUS.CLOSED) {
    return { error: '工单已关闭，无法继续更新' };
  }

  ticket.status = STATUS.DISPATCHED;
  ticket.dispatchedAt = getCurrentTime();
  ticket.maintenancePerson = maintenancePerson;
  return ticket;
}

function recordArrival(id) {
  const ticket = getTicketById(id);
  if (!ticket) return null;
  
  if (ticket.status === STATUS.CLOSED) {
    return { error: '工单已关闭，无法继续更新' };
  }
  if (ticket.status !== STATUS.DISPATCHED) {
    return { error: '必须先派单才能记录到场时间' };
  }

  ticket.status = STATUS.ON_SITE;
  ticket.arrivedAt = getCurrentTime();
  return ticket;
}

function recordRescue(id) {
  const ticket = getTicketById(id);
  if (!ticket) return null;
  
  if (ticket.status === STATUS.CLOSED) {
    return { error: '工单已关闭，无法继续更新' };
  }
  if (ticket.status !== STATUS.ON_SITE) {
    return { error: '必须先记录到场才能记录解救时间' };
  }

  ticket.status = STATUS.RESCUED;
  ticket.rescuedAt = getCurrentTime();
  return ticket;
}

function closeTicket(id, reviewData) {
  const ticket = getTicketById(id);
  if (!ticket) return null;
  
  if (ticket.status === STATUS.CLOSED) {
    return { error: '工单已关闭，无法重复关闭' };
  }
  if (ticket.status !== STATUS.RESCUED) {
    return { error: '必须先完成解救才能关闭工单' };
  }

  ticket.status = STATUS.CLOSED;
  ticket.closedAt = getCurrentTime();
  ticket.review = {
    issues: reviewData.issues || [],
    summary: reviewData.summary || '',
    improvementMeasures: reviewData.improvementMeasures || [],
    reviewer: reviewData.reviewer || ''
  };
  return ticket;
}

function mergeDuplicateTicket(existingTicketId, newReport) {
  const existingTicket = getTicketById(existingTicketId);
  if (!existingTicket) return null;

  existingTicket.mergeCount++;
  existingTicket.mergedFrom.push({
    id: uuidv4(),
    reporterName: newReport.reporterName,
    reporterPhone: newReport.reporterPhone,
    mergedAt: getCurrentTime()
  });

  if (newReport.trappedCount > existingTicket.trappedCount) {
    existingTicket.trappedCount = newReport.trappedCount;
  }
  if (newReport.description && !existingTicket.description) {
    existingTicket.description = newReport.description;
  }

  return existingTicket;
}

function calculateResponseTime(ticket) {
  if (!ticket.dispatchedAt || !ticket.reportedAt) return null;
  const reported = new Date(ticket.reportedAt).getTime();
  const dispatched = new Date(ticket.dispatchedAt).getTime();
  return Math.round((dispatched - reported) / 1000);
}

function calculateArrivalTime(ticket) {
  if (!ticket.arrivedAt || !ticket.dispatchedAt) return null;
  const dispatched = new Date(ticket.dispatchedAt).getTime();
  const arrived = new Date(ticket.arrivedAt).getTime();
  return Math.round((arrived - dispatched) / 1000);
}

function calculateRescueTime(ticket) {
  if (!ticket.rescuedAt || !ticket.arrivedAt) return null;
  const arrived = new Date(ticket.arrivedAt).getTime();
  const rescued = new Date(ticket.rescuedAt).getTime();
  return Math.round((rescued - arrived) / 1000);
}

function getStatistics() {
  const allTickets = getAllTickets();
  const now = Date.now();
  const TIMEOUT_SECONDS = 300; 

  const buildings = {};
  const elevators = {};
  
  allTickets.forEach(ticket => {
    if (!buildings[ticket.building]) {
      buildings[ticket.building] = {
        building: ticket.building,
        totalTickets: 0,
        openTickets: 0,
        averageResponseTime: 0,
        timeoutCount: 0,
        reviewIssues: []
      };
    }
    if (!elevators[`${ticket.building}-${ticket.elevator}`]) {
      elevators[`${ticket.building}-${ticket.elevator}`] = {
        building: ticket.building,
        elevator: ticket.elevator,
        totalTickets: 0,
        openTickets: 0,
        averageResponseTime: 0,
        timeoutCount: 0,
        reviewIssues: []
      };
    }

    buildings[ticket.building].totalTickets++;
    elevators[`${ticket.building}-${ticket.elevator}`].totalTickets++;

    if (ticket.status !== STATUS.CLOSED) {
      buildings[ticket.building].openTickets++;
      elevators[`${ticket.building}-${ticket.elevator}`].openTickets++;
      
      const responseTime = calculateResponseTime(ticket);
      if (!responseTime) {
        const reported = new Date(ticket.reportedAt).getTime();
        if ((now - reported) > (TIMEOUT_SECONDS * 1000)) {
          buildings[ticket.building].timeoutCount++;
          elevators[`${ticket.building}-${ticket.elevator}`].timeoutCount++;
        }
      }
    }

    if (ticket.review && ticket.review.issues) {
      buildings[ticket.building].reviewIssues = 
        [...new Set([...buildings[ticket.building].reviewIssues, ...ticket.review.issues])];
      elevators[`${ticket.building}-${ticket.elevator}`].reviewIssues = 
        [...new Set([...elevators[`${ticket.building}-${ticket.elevator}`].reviewIssues, ...ticket.review.issues])];
    }
  });

  return {
    buildings: Object.values(buildings),
    elevators: Object.values(elevators),
    openTickets: allTickets.filter(t => t.status !== STATUS.CLOSED),
    totalTickets: allTickets.length
  };
}

function checkTimeout(ticket) {
  if (ticket.status === STATUS.CLOSED) return false;
  if (!ticket.reportedAt) return false;
  
  const TIMEOUT_SECONDS = 300;
  const reported = new Date(ticket.reportedAt).getTime();
  const now = Date.now();
  
  return (now - reported) > (TIMEOUT_SECONDS * 1000) && ticket.status === STATUS.REPORTED;
}

module.exports = {
  STATUS,
  tickets,
  DUPLICATE_WINDOW_MINUTES,
  createTicket,
  getTicketById,
  getAllTickets,
  dispatchTicket,
  recordArrival,
  recordRescue,
  closeTicket,
  mergeDuplicateTicket,
  calculateResponseTime,
  calculateArrivalTime,
  calculateRescueTime,
  getStatistics,
  checkTimeout,
  findOpenTicketForElevator
};
