/**
 * @file modem.c
 * @brief Modem control (Go: system/modem.go)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include "modem.h"
#include "sysinfo.h"
#include "ofono.h"

/* 有效的网络模式 */
static const char *valid_modes[] = {"lte_only", "nr_5g_only", "nr_5g_lte_auto", "nsa_only", NULL};
static const char *valid_slots[] = {"slot1", "slot2", NULL};

int is_valid_network_mode(const char *mode) {
    if (!mode) return 0;
    for (int i = 0; valid_modes[i]; i++) {
        if (strcmp(mode, valid_modes[i]) == 0) return 1;
    }
    return 0;
}

int is_valid_slot(const char *slot) {
    if (!slot) return 0;
    for (int i = 0; valid_slots[i]; i++) {
        if (strcmp(slot, valid_slots[i]) == 0) return 1;
    }
    return 0;
}

int get_network_mode_code(const char *mode) {
    if (!mode) return -1;
    if (strcmp(mode, "lte_only") == 0) return MODE_LTE_ONLY;
    if (strcmp(mode, "nr_5g_only") == 0) return MODE_NR_5G_ONLY;
    if (strcmp(mode, "nr_5g_lte_auto") == 0) return MODE_NR_5G_LTE_AUTO;
    if (strcmp(mode, "nsa_only") == 0) return MODE_NSA_ONLY;
    return -1;
}

int set_network_mode(const char *mode) {
    return set_network_mode_for_slot(mode, NULL);
}

/* 最近一次设置网络模式时是否发生了降级（设备端 oFono 不认 NSA only） */
static int g_mode_fallback = 0;

int modem_last_mode_fallback(void) {
    return g_mode_fallback;
}

int set_network_mode_for_slot(const char *mode, const char *slot) {
    char ril_path[32];
    int mode_code;

    if (!is_valid_network_mode(mode)) {
        return -1;
    }

    mode_code = get_network_mode_code(mode);
    if (mode_code < 0) return -1;

    if (!slot || strlen(slot) == 0) {
        char slot_name[16];
        if (get_current_slot(slot_name, ril_path) != 0 || 
            strcmp(ril_path, "unknown") == 0 || strlen(ril_path) == 0) {
            return -1;
        }
    } else {
        if (strcmp(slot, "slot1") == 0) {
            strcpy(ril_path, "/ril_0");
        } else if (strcmp(slot, "slot2") == 0) {
            strcpy(ril_path, "/ril_1");
        } else {
            return -1;
        }
    }

    int rc = ofono_network_set_mode_sync(ril_path, mode_code, OFONO_TIMEOUT_MS);

    if (strcmp(mode, "nsa_only") != 0) {
        if (rc != 0) return -1;
        g_mode_fallback = 0;
        return 0;
    }

    /*
     * NSA(EN-DC) 要求 LTE 锚点与 NR 同时可用，所以"仅 NSA"必须落在
     * "LTE 与 NR 都允许"的档位上。这里不能只看设置接口是否返回成功：
     * 部分固件的 oFono 对 "NSA only" 既不报错也不真正切换，档位会停在
     * 原来的 "NR 5G only" 上——那样只有 5G、没有 LTE，B3 永远连不上，
     * 用户看到的现象就是"开了 NSA 只连 5G"。
     * 因此设置后一律回读实际档位，不是双制式允许就纠正为 NR 5G/LTE auto。
     */
    char applied[64] = {0};
    int dual_ok = (rc == 0) &&
                  ofono_network_get_mode_sync(ril_path, applied, sizeof(applied),
                                              OFONO_TIMEOUT_MS) == 0 &&
                  strstr(applied, "LTE") != NULL && strstr(applied, "only") == NULL;

    if (!dual_ok) {
        if (ofono_network_set_mode_sync(ril_path, MODE_NR_5G_LTE_AUTO,
                                        OFONO_TIMEOUT_MS) != 0) {
            return -1;
        }
        g_mode_fallback = 1;
        return 0;
    }

    g_mode_fallback = 0;
    return 0;
}

extern int ofono_is_initialized(void);

int switch_slot(const char *slot) {
    char target_ril[16], other_ril[16];
    char new_slot[16], new_ril[32];

    if (!ofono_is_initialized() || !is_valid_slot(slot)) {
        return -1;
    }

    if (strcmp(slot, "slot1") == 0) {
        strcpy(target_ril, "/ril_0");
        strcpy(other_ril, "/ril_1");
    } else {
        strcpy(target_ril, "/ril_1");
        strcpy(other_ril, "/ril_0");
    }

    /* 步骤1: 把当前卡槽设置为 LTE only (mode=5) */
    ofono_network_set_mode_sync(other_ril, MODE_LTE_ONLY, OFONO_TIMEOUT_MS);
    usleep(500 * 1000);  /* 500ms */

    /* 步骤2: 设置当前 ril 在线状态为 0 (关闭) */
    ofono_modem_set_online(other_ril, 0, OFONO_TIMEOUT_MS);

    /* 步骤3: 设置目标 ril 在线状态为 1 (开启) */
    ofono_modem_set_online(target_ril, 1, OFONO_TIMEOUT_MS);

    /* 步骤4: 设置数据卡为目标 ril */
    if (ofono_set_datacard(target_ril) == 0) {
        return -1;
    }

    /* 等待系统状态更新 */
    sleep(1);

    /* 步骤5: 把目标卡槽设置为 auto 模式 (mode=9) */
    ofono_network_set_mode_sync(target_ril, MODE_NR_5G_LTE_AUTO, OFONO_TIMEOUT_MS);

    /* 验证切换结果 */
    if (get_current_slot(new_slot, new_ril) != 0) {
        return -1;
    }

    /* 步骤6: 重启数据连接监听（切换到新卡槽） */
    if (ofono_is_data_monitor_running()) {
        printf("[Modem] 切卡完成，重启数据连接监听...\n");
        ofono_stop_data_monitor();
        ofono_start_data_monitor();
    }

    return 0;
}
