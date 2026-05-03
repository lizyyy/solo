export const sampleData = {
  garageStructure: {
    id: "garage-demo-001",
    name: "演示立体停车库",
    floors: [
      {
        id: "floor-0",
        level: 0,
        name: "地面层（入口）",
        height: 3.5,
        slots: [
          { id: "slot-0-01", position: { x: -12, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 },
          { id: "slot-0-02", position: { x: -8, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 },
          { id: "slot-0-03", position: { x: -4, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "charging", maxWeight: 2500 },
          { id: "slot-0-04", position: { x: 0, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 },
          { id: "slot-0-05", position: { x: 4, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 },
          { id: "slot-0-06", position: { x: 8, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 }
        ],
        aisles: [
          { id: "aisle-0-01", path: [{ x: -15, z: -5 }, { x: 10, z: -5 }], width: 3.0 }
        ]
      },
      {
        id: "floor-1",
        level: 1,
        name: "一层",
        height: 3.5,
        slots: [
          { id: "slot-1-01", position: { x: -12, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 },
          { id: "slot-1-02", position: { x: -8, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 },
          { id: "slot-1-03", position: { x: -4, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 },
          { id: "slot-1-04", position: { x: 0, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "charging", maxWeight: 2500 },
          { id: "slot-1-05", position: { x: 4, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 },
          { id: "slot-1-06", position: { x: 8, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 }
        ],
        aisles: [
          { id: "aisle-1-01", path: [{ x: -15, z: -5 }, { x: 10, z: -5 }], width: 3.0 }
        ]
      },
      {
        id: "floor-2",
        level: 2,
        name: "二层",
        height: 3.5,
        slots: [
          { id: "slot-2-01", position: { x: -12, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 },
          { id: "slot-2-02", position: { x: -8, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 },
          { id: "slot-2-03", position: { x: -4, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2000 },
          { id: "slot-2-04", position: { x: 0, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 },
          { id: "slot-2-05", position: { x: 4, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 },
          { id: "slot-2-06", position: { x: 8, z: 0 }, size: { width: 2.5, depth: 5.0 }, type: "standard", maxWeight: 2500 }
        ],
        aisles: [
          { id: "aisle-2-01", path: [{ x: -15, z: -5 }, { x: 10, z: -5 }], width: 3.0 }
        ]
      }
    ],
    elevators: [
      {
        id: "elevator-01",
        name: "升降机A",
        position: { x: -18, z: 0 },
        floors: [0, 1, 2],
        maxCapacity: 2500,
        speed: 2.0,
        currentFloor: 0
      },
      {
        id: "elevator-02",
        name: "升降机B",
        position: { x: 12, z: 0 },
        floors: [0, 1, 2],
        maxCapacity: 2500,
        speed: 2.0,
        currentFloor: 0
      }
    ]
  },

  reservationsCsv: `id,vehicle_id,type,request_time,target_floor,target_slot,weight,deadline
res-001,京A12345,park,2026-05-04 09:00:00,1,slot-1-01,1800,2026-05-04 09:02:00
res-002,京B67890,park,2026-05-04 09:00:30,1,slot-1-02,1600,2026-05-04 09:02:30
res-003,沪C11111,park,2026-05-04 09:01:00,2,slot-2-03,2800,2026-05-04 09:03:00
res-004,粤D22222,pickup,2026-05-04 09:02:00,1,slot-1-01,1800,2026-05-04 09:04:00
res-005,苏E33333,park,2026-05-04 09:03:00,2,slot-2-01,1900,2026-05-04 09:05:00
res-006,浙F44444,park,2026-05-04 09:03:30,1,slot-1-01,2000,2026-05-04 09:05:30
res-007,皖G55555,pickup,2026-05-04 09:04:00,2,slot-2-01,1900,2026-05-04 09:06:00
`,

  scheduleCommandsJsonl: `{"id":"cmd-001","time":"2026-05-04 09:00:05","type":"park","vehicle_id":"京A12345","elevator_id":"elevator-01","from_floor":0,"to_floor":1,"to_slot":"slot-1-01","path":[{"x":-15,"y":0.1,"z":5},{"x":-18,"y":0.1,"z":0}],"duration":30}
{"id":"cmd-002","time":"2026-05-04 09:00:15","type":"elevator","elevator_id":"elevator-01","from_floor":0,"to_floor":1,"vehicle_id":"京A12345","duration":15}
{"id":"cmd-003","time":"2026-05-04 09:00:35","type":"park","vehicle_id":"京A12345","from_floor":1,"to_slot":"slot-1-01","path":[{"x":-18,"y":3.6,"z":0},{"x":-12,"y":3.6,"z":0}],"duration":20}
{"id":"cmd-004","time":"2026-05-04 09:00:40","type":"park","vehicle_id":"京B67890","elevator_id":"elevator-01","from_floor":0,"to_floor":1,"to_slot":"slot-1-02","path":[{"x":-10,"y":0.1,"z":5},{"x":-18,"y":0.1,"z":0}],"duration":30}
{"id":"cmd-005","time":"2026-05-04 09:00:45","type":"elevator","elevator_id":"elevator-02","from_floor":0,"to_floor":2,"duration":10}
{"id":"cmd-006","time":"2026-05-04 09:01:00","type":"park","vehicle_id":"沪C11111","elevator_id":"elevator-02","from_floor":0,"to_floor":2,"to_slot":"slot-2-03","path":[{"x":15,"y":0.1,"z":5},{"x":12,"y":0.1,"z":0}],"duration":25}
{"id":"cmd-007","time":"2026-05-04 09:01:15","type":"elevator","elevator_id":"elevator-01","from_floor":1,"to_floor":0,"duration":10}
{"id":"cmd-008","time":"2026-05-04 09:01:20","type":"park","vehicle_id":"京B67890","from_floor":1,"to_slot":"slot-1-02","path":[{"x":-18,"y":3.6,"z":0},{"x":-8,"y":3.6,"z":0}],"duration":20}
{"id":"cmd-009","time":"2026-05-04 09:01:30","type":"elevator","elevator_id":"elevator-02","from_floor":2,"to_floor":0,"vehicle_id":"沪C11111","duration":10}
{"id":"cmd-010","time":"2026-05-04 09:01:45","type":"park","vehicle_id":"沪C11111","from_floor":2,"to_slot":"slot-2-03","path":[{"x":12,"y":7.1,"z":0},{"x":-4,"y":7.1,"z":0}],"duration":25}
{"id":"cmd-011","time":"2026-05-04 09:02:10","type":"move","vehicle_id":"京A12345","from_slot":"slot-1-01","to_slot":"slot-1-04","path":[{"x":-12,"y":3.6,"z":0},{"x":-12,"y":3.6,"z":-5},{"x":0,"y":3.6,"z":-5},{"x":0,"y":3.6,"z":0}],"duration":20}
{"id":"cmd-012","time":"2026-05-04 09:02:30","type":"pickup","vehicle_id":"京A12345","from_slot":"slot-1-04","elevator_id":"elevator-01","to_floor":0,"path":[{"x":0,"y":3.6,"z":0},{"x":-18,"y":3.6,"z":0}],"duration":30}
{"id":"cmd-013","time":"2026-05-04 09:02:45","type":"park","vehicle_id":"浙F44444","elevator_id":"elevator-01","from_floor":0,"to_floor":1,"to_slot":"slot-1-01","path":[{"x":-15,"y":0.1,"z":5},{"x":-18,"y":0.1,"z":0}],"duration":30}
{"id":"cmd-014","time":"2026-05-04 09:02:50","type":"park","vehicle_id":"苏E33333","elevator_id":"elevator-02","from_floor":0,"to_floor":2,"to_slot":"slot-2-01","path":[{"x":15,"y":0.1,"z":5},{"x":12,"y":0.1,"z":0}],"duration":25}
{"id":"cmd-015","time":"2026-05-04 09:03:00","type":"elevator","elevator_id":"elevator-01","from_floor":1,"to_floor":0,"vehicle_id":"京A12345","duration":15}
{"id":"cmd-016","time":"2026-05-04 09:03:15","type":"elevator","elevator_id":"elevator-01","from_floor":0,"to_floor":1,"vehicle_id":"浙F44444","duration":15}
{"id":"cmd-017","time":"2026-05-04 09:03:30","type":"park","vehicle_id":"浙F44444","from_floor":1,"to_slot":"slot-1-01","path":[{"x":-18,"y":3.6,"z":0},{"x":-12,"y":3.6,"z":0}],"duration":20}
{"id":"cmd-018","time":"2026-05-04 09:03:45","type":"elevator","elevator_id":"elevator-02","from_floor":0,"to_floor":2,"vehicle_id":"苏E33333","duration":10}
{"id":"cmd-019","time":"2026-05-04 09:04:00","type":"park","vehicle_id":"苏E33333","from_floor":2,"to_slot":"slot-2-01","path":[{"x":12,"y":7.1,"z":0},{"x":-12,"y":7.1,"z":0}],"duration":25}
{"id":"cmd-020","time":"2026-05-04 09:04:30","type":"pickup","vehicle_id":"苏E33333","from_slot":"slot-2-01","elevator_id":"elevator-02","to_floor":0,"path":[{"x":-12,"y":7.1,"z":0},{"x":12,"y":7.1,"z":0}],"duration":30}
`,

  deviceRulesYaml: `# 立体停车库设备规则配置
elevators:
  - id: elevator-01
    max_capacity: 2500
    speed: 2.0
    acceleration: 0.5
    max_floors: 10
    door_open_time: 3
    door_close_time: 3
  - id: elevator-02
    max_capacity: 2500
    speed: 2.0
    acceleration: 0.5
    max_floors: 10
    door_open_time: 3
    door_close_time: 3

shuttles:
  - id: shuttle-01
    max_capacity: 2500
    speed: 3.0
    acceleration: 1.0
  - id: shuttle-02
    max_capacity: 2500
    speed: 3.0
    acceleration: 1.0

safety:
  min_distance_between_cars: 1.5
  max_occupancy_per_zone: 8
  emergency_stop_delay: 0.5

timing:
  park_time_limit: 120
  pickup_time_limit: 180
  transfer_time_limit: 60
`
};
