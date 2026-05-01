import sys
import tkinter as tk
from sensor_gateway_manager.ui.main_window import SensorGatewayApp


def main():
    root = tk.Tk()
    app = SensorGatewayApp(root)
    app.run()


if __name__ == "__main__":
    main()