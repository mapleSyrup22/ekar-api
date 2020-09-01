require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const FormData = require("form-data");
const e = require("express");

const app = express();

app.use(bodyParser.json());

const host = "https://hst-api.wialon.com/wialon/ajax.html?svc=token/login";
const token = process.env.WIALON_TOKEN;
app.get("/", (req, res) => {
  res.send(
    "<h1>Working Routes</h1> <br><h4>Get Units: '/getUnits'</h4><br><h4>Get Unit Interval: '/getUnitInterval'</h4><p>POST Request</p><p>Query Parameters:</p><p>device_id</p><p>start_time</p><p>end_time</p>" +
      "<p>Note: (fuel_level) A specific custom fuel level sensor must be created for each vehicle in order to get vehicle fuel level data</p>"
  );
});

app.get("/getUnits", (req, res) => {
  let formData = new FormData();
  formData.append("params", JSON.stringify({ token: token }));

  axios
    .post(host, formData, { headers: formData.getHeaders() })
    .then((response) => {
      let searchItems = new FormData();

      searchItems.append("sid", response.data.eid);
      searchItems.append(
        "params",
        JSON.stringify({
          spec: {
            itemsType: "avl_unit",
            propName: "sys_name",
            propValueMask: "*",
            sortType: "sys_name",
            propType: "property",
          },
          force: 1,
          // flags used 4194304 256 1 8192 1048576 4096
          flags: 5255425,
          from: 0,
          to: 0,
        })
      );

      axios
        .post(
          "https://hst-api.wialon.com/wialon/ajax.html?svc=core/search_items",
          searchItems,
          { headers: searchItems.getHeaders() }
        )
        .then((itemResponse) => {
          let allUnits = itemResponse.data.items;
          let organizedData = [];
          allUnits.map((unit) => {
            let unitDetails = {};
            unitDetails.device_id = unit.uid;

            unitDetails.gps_latitude = unit.pos
              ? unit.pos["x"]
              : (unitDetails.gps_latitude = "N/A");
            unitDetails.gps_longitude = unit.pos
              ? unit.pos["y"]
              : (unitDetails.gps_longitude = "N/A");
            unitDetails.gps_signal = unit.pos
              ? unit.pos["sc"]
              : (unitDetails.gps_signal = "N/A");
            unitDetails.mileage = unit.cnm;
            if (unit.sens) {
              let arrayKeys = Object.keys(unit.sens);
              arrayKeys.map((key) => {
                let sensors = unit.sens[key];

                if (sensors) {
                  if (sensors.tbl) {
                    if (sensors.tbl[0]) {
                      let multiplier = sensors.tbl[0].a;
                      let metrics = sensors.m;
                      if (unit.prms) {
                        if (unit.prms.can_fls) {
                          if (unit.prms.can_fls.v) {
                            let sensorValue = unit.prms.can_fls.v;
                            unitDetails.fuel_level =
                              sensorValue * multiplier + " " + metrics;
                          }
                        }
                      }
                    }
                  }
                }
                unitDetails.fuel_level = "No Custom Fuel Sensor Found";
              });
            }
            unitDetails.direction = unit.pos
              ? unit.pos["c"]
              : (unitDetails.direction = "N/A");
            unitDetails.wheelbased_speed = unit.pos
              ? unit.pos["s"]
              : (unitDetails.wheelbased_speed = "N/A");
            unitDetails.recorded_at = unit.pos
              ? unit.pos["t"]
              : (unitDetails.recorded_at = "N/A");
            organizedData.push(unitDetails);
          });
          res.json(organizedData);
        });
    });
});

app.post("/getUnitInterval", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  let device_id = req.body.device_id;
  let start_time = req.body.start_time;
  let end_time = req.body.end_time;

  let formData = new FormData();
  formData.append("params", JSON.stringify({ token: token }));

  axios
    .post(host, formData, { headers: formData.getHeaders() })
    .then((response) => {
      let searchItem = new FormData();
      searchItem.append("sid", response.data.eid);
      searchItem.append(
        "params",
        JSON.stringify({
          spec: {
            itemsType: "avl_unit",
            propName: "sys_name",
            propValueMask: "*",
            sortType: "sys_name",
            propType: "property",
          },
          force: 1,
          // flags used 4194304 256 1 8192 1048576 4096
          flags: 5255425,
          from: 0,
          to: 0,
        })
      );
      axios
        .post(
          "https://hst-api.wialon.com/wialon/ajax.html?svc=core/search_items",
          searchItem,
          { headers: searchItem.getHeaders() }
        )
        .then((itemResponse) => {
          let allUnits = itemResponse.data.items;
          let unitId = [];
          allUnits.map((unit) => {
            if (unit.uid == device_id) {
              unitId.push(unit.id);
            }
          });
          if (unitId.length === 1) {
            let getItem = new FormData();
            getItem.append("sid", response.data.eid);
            getItem.append(
              "params",
              JSON.stringify({
                itemId: unitId[0],
                timeFrom: start_time,
                timeTo: end_time,
                flags: 0x0003,
                flagsMask: 0xff03,
                loadCount: 0xffffffff,
              })
            );

            axios
              .post(
                "https://hst-api.wialon.com/wialon/ajax.html?svc=messages/load_interval",
                getItem,
                { headers: getItem.getHeaders() }
              )
              .then((msgResponse) => {
                let organizedMsgs = [];
                let unitMessages = msgResponse.data.messages;
                unitMessages.map((msg) => {
                  let setMsg = {};
                  msg.pos["x"]
                    ? (setMsg.gps_latitude = msg.pos["x"])
                    : (setMsg.gps_latitude = "N/A");
                  msg.pos["y"]
                    ? (setMsg.gps_longitude = msg.pos["y"])
                    : (setMsg.gps_longitude = "N/A");
                  msg.pos["sc"]
                    ? (setMsg.gps_signal = msg.pos["sc"])
                    : (setMsg.gps_signal = "N/A");
                  msg.p["odo"]
                    ? (setMsg.mileage = msg.p["odo"])
                    : (setMsg.mileage = "N/A");
                  msg.p["can_fls"]
                    ? (setMsg.fuel_level = msg.p["can_fls"])
                    : "No Custom Fuel Sensor Found";
                  msg.pos["c"]
                    ? (setMsg.direction = msg.pos["c"])
                    : (setMsg.direction = "N/A");
                  msg.p["wheel_speed"]
                    ? (setMsg.wheelbased_speed = msg.p["wheel_speed"])
                    : (setMsg.wheelbased_speed = "N/A");
                  msg["t"]
                    ? (setMsg.recorded_at = msg["t"])
                    : (setMsg.recorded_at = "N/A");
                  organizedMsgs.push(setMsg);
                });
                res.json(organizedMsgs);
              });
          }
        });
    });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`server now running at port ${PORT}`);
});
