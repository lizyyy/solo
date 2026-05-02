import tkinter as tk
from datetime import datetime
from import_validator import ImportValidator
from shelf_matcher import ShelfMatcher
from order_state_machine import OrderStateMachine, OrderStatus, ExceptionType
from persistence import PersistenceManager
from exporter import Exporter
from gui import OrderGUI
import os

class App:
    def __init__(self):
        self.root = tk.Tk()
        self.gui = OrderGUI(self.root)
        
        self.order_state_machine = OrderStateMachine()
        self.shelf_matcher = None
        self.persistence = PersistenceManager()
        
        self._setup_callbacks()
        self._load_data()
        
    def _setup_callbacks(self):
        self.gui.set_scan_callback(self._handle_scan)
        self.gui.set_status_change_callback(self._handle_status_change)
        self.gui.set_notes_change_callback(self._handle_notes_change)
        self.gui.set_export_callback(self._handle_export)
        
    def _load_data(self):
        sample_dir = 'sample_data'
        orders_path = os.path.join(sample_dir, 'orders.csv')
        events_path = os.path.join(sample_dir, 'scan_events.jsonl')
        shelf_path = os.path.join(sample_dir, 'shelf_map.yaml')
        
        try:
            data = ImportValidator.validate_all(orders_path, events_path, shelf_path)
            
            self.shelf_matcher = ShelfMatcher(data['shelf_map'])
            
            for order in data['orders']:
                self.order_state_machine.add_order(order)
            
            for event in data['scan_events']:
                self.order_state_machine.record_scan(
                    event['sku'],
                    event['shelf_code'],
                    event['scan_time'],
                    event['scanner_id']
                )
            
            self._load_saved_notes()
            
            self._update_gui()
            
        except Exception as e:
            tk.messagebox.showerror("加载失败", str(e))
            
    def _load_saved_notes(self):
        notes = self.persistence.load_notes()
        for order_id, note in notes.items():
            self.order_state_machine.update_notes(order_id, note)
            
    def _update_gui(self):
        all_orders = list(self.order_state_machine.orders.values())
        self.gui.update_orders(all_orders)
        
        shelves = self.shelf_matcher.get_all_shelf_codes() if self.shelf_matcher else []
        self.gui.update_shelves(shelves)
        
        stats = self.order_state_machine.get_stats()
        self.gui.update_stats(stats)
        
    def _handle_scan(self, sku: str):
        if not self.shelf_matcher:
            return
            
        result = self.order_state_machine.record_scan(
            sku=sku,
            shelf_code='DEFAULT',
            scan_time=datetime.now().isoformat(),
            scanner_id='MANUAL'
        )
        
        color = 'green' if result['status'] == 'success' else 'red' if result['status'] == 'exception' else 'orange'
        self.gui.show_message(result['message'], color)
        
        self._update_gui()
        self._save_notes()
        
    def _handle_status_change(self, order_id: str, status: OrderStatus):
        if status == OrderStatus.EXCEPTION:
            self.order_state_machine.set_exception(order_id, ExceptionType.OTHER)
        elif status == OrderStatus.PENDING:
            self.order_state_machine.set_pending(order_id)
            
        self._update_gui()
        self._save_notes()
        
    def _handle_notes_change(self, order_id: str, notes: str):
        self.order_state_machine.update_notes(order_id, notes)
        self._save_notes()
        
    def _save_notes(self):
        notes = {}
        for order in self.order_state_machine.orders.values():
            if order.notes:
                notes[order.order_id] = order.notes
        self.persistence.save_notes(notes)
        
    def _handle_export(self):
        orders = list(self.order_state_machine.orders.values())
        Exporter.export_pickup_report(orders, 'pickup_report.md')
        Exporter.export_refund_list(orders, 'refund_list.csv')
        
    def run(self):
        self.root.mainloop()

if __name__ == '__main__':
    app = App()
    app.run()