/**
 * ESSL ADMS / iClock Protocol Handler
 * Handles communication with ESSL biometric devices
 */
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const dayjs = require('dayjs');

// Parse raw text body for ADMS updates (sometimes sent as text/plain or octet-stream)
router.use(express.text({ type: '*/*', limit: '10mb' }));

// GET /iclock/cdata — Device registration & config pull
// GET /iclock/cdata — Device registration & config pull
router.get(['/cdata', '/cdata.aspx'], async (req, res, next) => {
    try {
        const { SN, options, pushver, language } = req.query;

        if (!SN) {
            return res.status(400).send('ERROR: No serial number');
        }

        // Find device by serial number
        const device = await prisma.device.findFirst({
            where: { serialNumber: SN },
        });

        if (!device) {
            console.log(`[iClock] Unknown device: ${SN}`);
            // Auto-register the device (find any tenant's device with this SN)
            return res.send('OK');
        }

        // Update last seen
        await prisma.device.update({
            where: { id: device.id },
            data: { lastSeenAt: new Date(), status: 'active' },
        });

        if (options === 'all') {
            // Device is requesting its full config
            const config = [
                'GET OPTION FROM: ' + SN,
                'Stamp=9999',
                'OpStamp=9999',
                'PhotoStamp=9999',
                'ErrorDelay=60',
                'Delay=30',
                'TransTimes=00:00;14:05',
                'TransInterval=1',
                'TransFlag=TransData AttLog\tOpLog\tAttPhoto\tEnrollUser\tEnrollFP\tFPImag',
                'ServerVer=2.4.1',
                'ATTLOGStamp=0',
                'OPERLOGStamp=0',
            ].join('\r\n');
            return res.send(config);
        }

        res.send('OK');
    } catch (error) {
        console.error('[iClock] GET error:', error);
        res.status(500).send('ERROR');
    }
});

// POST /iclock/cdata — Receive attendance/operation logs
// POST /iclock/cdata — Receive attendance/operation logs
router.post(['/cdata', '/cdata.aspx'], async (req, res, next) => {
    try {
        const { SN, table } = req.query;

        if (!SN) {
            return res.status(400).send('ERROR: No SN');
        }

        const device = await prisma.device.findFirst({
            where: { serialNumber: SN },
        });

        if (!device) {
            console.log(`[iClock] POST from unknown device: ${SN}`);
            return res.send('OK: 0');
        }

        // Update last seen
        await prisma.device.update({
            where: { id: device.id },
            data: { lastSeenAt: new Date(), status: 'active' },
        });

        const rawBody = (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) || '';

        // Debug logging
        console.log(`[iClock] Received POST from ${SN}. Content-Type: ${req.headers['content-type']}. Body length: ${rawBody.length}`);
        if (rawBody.length > 0) console.log(`[iClock] Body preview: ${rawBody.substring(0, 100)}`);

        if (table === 'ATTLOG' || !table) {
            // Parse attendance log lines
            // Format: userId\tdateTime\tverifyMode\tinOutMode\tworkCode
            const lines = rawBody.split('\n').filter(l => l.trim());
            let processed = 0;

            for (const line of lines) {
                try {
                    const parts = line.split('\t');
                    if (parts.length < 2) continue;

                    const userId = parts[0].trim();
                    const dateTimeStr = parts[1].trim();
                    const verifyMode = parts[2]?.trim() || '0';
                    const inOutMode = parts[3]?.trim() || '0';

                    if (!userId || !dateTimeStr) continue;

                    // Log the raw data
                    const punchTime = dayjs(dateTimeStr, 'YYYY-MM-DD HH:mm:ss').toDate();

                    // Validation: Ignore future punches (with 5-minute buffer for slight clock drifts)
                    if (dayjs(punchTime).isAfter(dayjs().add(5, 'minute'))) {
                        console.warn(`[iClock] Ignoring future-dated punch: User ${userId} at ${dateTimeStr} (Server time: ${dayjs().format()}). This usually indicates an incorrect device clock.`);
                        continue;
                    }

                    // Check for existing log
                    let currentLog = await prisma.deviceLog.findFirst({
                        where: {
                            deviceId: device.id,
                            userId,
                            punchTime,
                        },
                    });

                    if (!currentLog) {
                        currentLog = await prisma.deviceLog.create({
                            data: {
                                tenantId: device.tenantId,
                                deviceId: device.id,
                                rawData: line,
                                userId,
                                punchTime,
                                processed: false,
                            },
                        });
                    } else if (currentLog.processed) {
                        // Already processed, skip
                        continue;
                    }
                    // Else: Log exists but processed=false. Proceed to process it.

                    // Find employee by code
                    let employee = await prisma.employee.findFirst({
                        where: { tenantId: device.tenantId, employeeCode: userId },
                    });

                    if (!employee) {
                        try {
                            // Auto-create employee from device user
                            const newContact = await prisma.contact.create({
                                data: {
                                    tenantId: device.tenantId,
                                    firstName: 'Device User',
                                    lastName: userId,
                                },
                            });

                            employee = await prisma.employee.create({
                                data: {
                                    tenantId: device.tenantId,
                                    contactId: newContact.id,
                                    employeeCode: userId,
                                    joiningDate: new Date(),
                                    type: 'full_time',
                                    status: 'active',
                                },
                            });

                            // Auto-create User account
                            const bcrypt = require('bcryptjs');
                            const passwordHash = await bcrypt.hash(userId, 10);
                            await prisma.user.create({
                                data: {
                                    tenantId: device.tenantId,
                                    username: userId,
                                    passwordHash,
                                    role: 'employee',
                                    employeeId: employee.id,
                                },
                            });

                            console.log(`[iClock] Auto-created employee & user ${userId} from device ${SN}`);
                        } catch (err) {
                            console.error(`[iClock] Failed to auto-create employee ${userId}:`, err);
                        }
                    }

                    if (employee) {
                        const nowIST = dayjs.tz(punchTime, TZ);
                        const dateStr = nowIST.format('YYYY-MM-DD');

                        // 1. ROBUST LOOKBACK: Check for any open or recent timesheet in the last 22 hours
                        let timesheet = await prisma.timesheet.findFirst({
                            where: {
                                tenantId: device.tenantId,
                                employeeId: employee.id,
                                inAt: {
                                    gte: dayjs(punchTime).subtract(22, 'hour').toDate(),
                                    lte: punchTime
                                }
                            },
                            orderBy: { inAt: 'desc' }
                        });

                        if (timesheet) {
                            // Timesheet exists
                            let existingPunches = timesheet.punches || [];
                            if (typeof existingPunches === 'string') {
                                try { existingPunches = JSON.parse(existingPunches); } catch (e) { existingPunches = []; }
                            }
                            if (!Array.isArray(existingPunches)) existingPunches = [];

                            const lastPunchTime = existingPunches.length > 0 
                                ? dayjs(existingPunches[existingPunches.length - 1].time) 
                                : dayjs(timesheet.inAt);

                            const diffFromLastMs = dayjs(punchTime).diff(lastPunchTime);
                            
                            if (diffFromLastMs >= 120000) { // 2 minutes gap to avoid duplicates
                                const newPunch = { time: punchTime, device_sn: SN, type: 'auto' };
                                const updatedPunches = [...existingPunches, newPunch];
                                
                                await prisma.timesheet.update({
                                    where: { id: timesheet.id },
                                    data: { 
                                        punches: updatedPunches,
                                        outAt: punchTime 
                                    },
                                });
                                console.log(`[iClock] Updated TS ${timesheet.id} for ${userId} with OUT punch ${dayjs(punchTime).format('HH:mm')}`);
                            } else {
                                console.log(`[iClock] Ignored duplicate punch for ${userId} (diff: ${diffFromLastMs}ms)`);
                            }
                        } else {
                            // First punch of the day: Clock in
                            const firstPunch = { time: punchTime, device_sn: SN, type: 'in' };
                            const dbDate = dayjs.utc(dateStr).toDate();
                            
                            await prisma.timesheet.create({
                                data: {
                                    tenantId: device.tenantId,
                                    employeeId: employee.id,
                                    date: dbDate,
                                    inAt: punchTime,
                                    outAt: null, 
                                    punches: [firstPunch],
                                    source: 'device',
                                    status: 'auto_approved',
                                    meta: { device_sn: SN, verify_mode: verifyMode, in_out_mode: inOutMode },
                                },
                            });
                            console.log(`[iClock] Created new TS for ${userId} at ${dayjs(punchTime).format('HH:mm')}`);
                        }

                        // Mark log as processed
                        await prisma.deviceLog.updateMany({
                            where: { deviceId: device.id, userId, punchTime, processed: false },
                            data: { processed: true },
                        });
                    }

                    processed++;
                } catch (lineError) {
                    console.error(`[iClock] Error processing line: ${line}`, lineError.message);
                }
            }

            console.log(`[iClock] Device ${SN}: processed ${processed}/${lines.length} records`);
            return res.send(`OK: ${processed}`);
        }

        if (table === 'OPERLOG') {
            // Operation log — ignore for now
            return res.send('OK: 0');
        }

        res.send('OK: 0');
    } catch (error) {
        console.error('[iClock] POST error:', error);
        res.status(500).send('ERROR');
    }
});

// GET /iclock/getrequest — Device polls for pending commands
// GET /iclock/getrequest — Device polls for pending commands
router.get(['/getrequest', '/getrequest.aspx'], async (req, res, next) => {
    try {
        const { SN } = req.query;
        if (!SN) return res.send('OK');

        // Update last seen heartbeat
        const device = await prisma.device.findFirst({ where: { serialNumber: SN } });
        if (device) {
            await prisma.device.update({
                where: { id: device.id },
                data: { lastSeenAt: new Date(), status: 'active' },
            });
        }

        // Check for pending commands
        // Check for pending commands
        if (device) {
            const cmd = await prisma.deviceCommand.findFirst({
                where: { deviceId: device.id, status: 'pending' },
                orderBy: { createdAt: 'asc' },
            });

            if (cmd) {
                // Send command: C:ID:COMMAND
                // Example: C:1:DATA QUERY ATTLOG ...
                const payload = `C:${cmd.id}:${cmd.command}`;
                await prisma.deviceCommand.update({
                    where: { id: cmd.id },
                    data: { status: 'sent' },
                });
                console.log(`[iClock] Sending command to ${SN}: ${payload}`);
                return res.send(payload);
            }
        }

        res.send('OK');
    } catch (error) {
        console.error('[iClock] GET request error:', error);
        res.send('OK');
    }
});

// POST /iclock/devicecmd — Device command response
// POST /iclock/devicecmd — Device command response
router.post(['/devicecmd', '/devicecmd.aspx'], async (req, res, next) => {
    try {
        // ID=123&Return=0
        let { ID, Return } = req.body;

        // Fallback to query if body empty
        if (!ID && req.query.ID) {
            ID = req.query.ID;
            Return = req.query.Return;
        }

        if (ID) {
            const cmdId = parseInt(ID);
            // Update command status
            await prisma.deviceCommand.updateMany({
                where: { id: cmdId },
                data: {
                    status: Return == 0 ? 'executed' : 'failed',
                    response: JSON.stringify(req.body || req.query),
                    updatedAt: new Date(),
                },
            });
            console.log(`[iClock] Command ${cmdId} response: ${Return}`);
        }
        res.send('OK');
    } catch (error) {
        console.error('[iClock] devicecmd error:', error);
        res.send('OK');
    }
});

module.exports = router;
