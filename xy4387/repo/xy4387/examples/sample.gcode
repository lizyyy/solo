;FLAVOR:Marlin
;TIME:9000
;Filament used: 3.2m
;Layer height: 0.2
;MINX:10.0
;MINY:10.0
;MINZ:0.2
;MAXX:190.0
;MAXY:190.0
;MAXZ:50.0
;Generated with Cura_SteamEngine 5.3.0
;
;SETTINGS_3:
;Nozzle temperature: 200
;Bed temperature: 60
;Material: PLA
;Print time: 150 minutes
;Infill: 20%
;
M140 S60
M105
M190 S60
M104 S200
M105
M109 S200
G28 ;Home
G1 Z15.0 F6000 ;Move the platform down 15mm
;Prime the extruder
G92 E0
G1 F200 E3
G92 E0
LAYER_COUNT:250
;LAYER:0
M107
G0 F6000 X15.0 Y15.0 Z0.3
;TYPE:SKIRT
G1 F1200 X15.0 Y185.0 E0.04102
G1 X185.0 Y185.0 E0.08204
G1 X185.0 Y15.0 E0.12306
G1 X15.0 Y15.0 E0.16408
;LAYER:1
G0 F6000 X15.0 Y15.0 Z0.5
;TYPE:WALL-INNER
G1 F1200 X185.0 Y15.0 E0.51234
G1 X185.0 Y185.0 E0.86060
;... (rest of G-code omitted for example)
M104 S0
M140 S0
;Retract the filament
G92 E1
G1 E-1 F300
G28 X0 Y0
M84
M82 ;absolute extrusion mode
M104 S0
;End of Gcode
