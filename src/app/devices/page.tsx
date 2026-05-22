"use client";

import { useEffect, useState } from "react";

import Sidebar from "@/components/dashboard/Sidebar";

export default function DevicesPage() {

  const [devices, setDevices] =
    useState<any[]>([]);

  const [deviceId, setDeviceId] =
    useState("");

  const [deviceName, setDeviceName] =
    useState("");

  const [showModal, setShowModal] =
    useState(false);

  // Fetch live devices
  useEffect(() => {

    const fetchDevices = async () => {

      try {

        const res = await fetch(
          "/api/devices"
        );

        const json = await res.json();

        if (json.success) {
          setDevices(json.data);
        }

      } catch (err) {
        console.error(err);
      }

    };

    fetchDevices();

    const interval = setInterval(
      fetchDevices,
      3000
    );

    return () =>
      clearInterval(interval);

  }, []);

  // Add local device
  const handleAddDevice = () => {

    if (!deviceId || !deviceName) {
      return;
    }

    const newDevice = {
      device: deviceId,
      name: deviceName,
      voltage: "--",
      battery: "--",
      power: "--"
    };

    setDevices((prev) => [
      ...prev,
      newDevice
    ]);

    setDeviceId("");
    setDeviceName("");
  };

  return (

    <main className="
      flex min-h-screen
      bg-gradient-light
      text-slate-900
    ">

      <Sidebar />

      <section className="flex-1 p-8">

        {/* Header */}

        <div className="
          flex items-center
          justify-between
          mb-8
        ">

          <h1 className="text-4xl font-bold">
            Live Microgrids
          </h1>

          <button
            onClick={() =>
              setShowModal(true)
            }
            className="
              bg-cyan-600
              text-white
              px-5 py-3
              rounded-xl
              font-extrabold
              hover:scale-105
              transition
              shadow-sm
            "
          >
            + Add Device
          </button>

        </div>

        {/* Device Cards */}

        <div className="
          grid grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          gap-6
        ">

          {devices.map((device) => (

            <div
              key={device.device}
              className={`
                rounded-2xl
                p-6
                border-2
                transition-all
                shadow-md
                hover:shadow-lg
                hover:scale-[1.02]
                duration-300
                ${
                  device.battery > 70
                    ? "bg-gradient-to-br from-green-50/85 to-emerald-200/50 backdrop-blur-sm border-green-300/50 text-green-950"
                    : device.battery > 40
                    ? "bg-gradient-to-br from-amber-50/85 to-orange-200/50 backdrop-blur-sm border-amber-300/50 text-amber-950"
                    : "bg-gradient-to-br from-red-50/85 to-rose-200/50 backdrop-blur-sm border-red-300/50 text-red-950"
                }
              `}
            >

              <h2 className="
                text-2xl
                font-black
                mb-3
                text-slate-800
              ">
                {device.name || device.device}
              </h2>

              {/* Status Badge */}

              <div
                className={`
                  inline-block
                  px-3 py-1
                  rounded-full
                  text-xs
                  font-black
                  mb-4
                  ${
                    device.battery > 70
                      ? "bg-green-600 text-white"
                      : device.battery > 40
                      ? "bg-amber-500 text-white"
                      : "bg-red-600 text-white"
                  }
                `}
              >
                {
                  device.battery > 70
                    ? "OPTIMAL"
                    : device.battery > 40
                    ? "WARNING"
                    : "CRITICAL"
                }
              </div>

              <p className="mb-2 text-slate-700 font-semibold">
                Voltage:
                {" "}
                <span className="font-extrabold text-slate-900">{device.voltage}V</span>
              </p>

              <p className="mb-2 text-slate-700 font-semibold">
                Battery:
                {" "}
                <span className="font-extrabold text-slate-900">{device.battery}%</span>
              </p>

              <p className="text-slate-700 font-semibold">
                Power:
                {" "}
                <span className="font-extrabold text-slate-900">{device.power}W</span>
              </p>

            </div>

          ))}

        </div>

        {/* Add Device Modal */}

        {
          showModal && (

            <div className="
              fixed inset-0
              bg-black/60
              flex items-center
              justify-center
              z-50
            ">

              <div className="
                bg-gradient-to-br from-white/90 to-slate-100/80
                backdrop-blur-lg
                p-8
                rounded-2xl
                w-full
                max-w-md
                border-2
                border-slate-200/50
                shadow-2xl
                text-slate-900
              ">

                <div className="
                  flex items-center
                  justify-between
                  mb-6
                ">

                  <h2 className="
                    text-2xl
                    font-black
                    text-slate-800
                  ">
                    Register Device
                  </h2>

                  <button
                    onClick={() =>
                      setShowModal(false)
                    }
                    className="
                      text-red-500
                      text-2xl
                      font-bold
                    "
                  >
                    ✕
                  </button>

                </div>

                <div className="space-y-4">

                  <input
                    value={deviceId}
                    onChange={(e) =>
                      setDeviceId(
                        e.target.value
                      )
                    }
                    placeholder="Device ID"
                    className="
                      w-full
                      p-4
                      rounded-xl
                      bg-slate-50
                      border-2
                      border-slate-200
                      text-slate-900
                      placeholder-slate-400
                      focus:outline-none
                      focus:border-cyan-500
                    "
                  />

                  <input
                    value={deviceName}
                    onChange={(e) =>
                      setDeviceName(
                        e.target.value
                      )
                    }
                    placeholder="Device Name"
                    className="
                      w-full
                      p-4
                      rounded-xl
                      bg-slate-50
                      border-2
                      border-slate-200
                      text-slate-900
                      placeholder-slate-400
                      focus:outline-none
                      focus:border-cyan-500
                    "
                  />

                  <button
                    onClick={() => {

                      handleAddDevice();

                      setShowModal(false);

                    }}
                    className="
                      w-full
                      bg-cyan-600
                      text-white
                      py-3
                      rounded-xl
                      font-black
                    "
                  >
                    Register Device
                  </button>

                </div>

              </div>

            </div>

          )
        }

      </section>

    </main>

  );
}