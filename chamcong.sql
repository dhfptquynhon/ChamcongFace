-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: localhost    Database: chamcong
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `cham_cong`
--

DROP TABLE IF EXISTS `cham_cong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cham_cong` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nhan_vien_id` int NOT NULL,
  `ma_nhan_vien` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_nhan_vien` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ngay_cham_cong` date NOT NULL,
  `gio_vao` time DEFAULT NULL,
  `gio_ra` time DEFAULT NULL,
  `trang_thai` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thoi_gian_lam` float DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ngay_cham_cong` (`ngay_cham_cong`),
  KEY `idx_nhan_vien_id` (`nhan_vien_id`),
  KEY `idx_ma_nhan_vien` (`ma_nhan_vien`),
  CONSTRAINT `fk_chamcong_nhanvien` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhanvien` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cham_cong`
--

LOCK TABLES `cham_cong` WRITE;
/*!40000 ALTER TABLE `cham_cong` DISABLE KEYS */;
/*!40000 ALTER TABLE `cham_cong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lich_truc`
--

DROP TABLE IF EXISTS `lich_truc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lich_truc` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ngay` date NOT NULL,
  `ca` enum('ca1','ca2','ca3','ca4') COLLATE utf8mb4_unicode_ci NOT NULL,
  `nhan_vien_id` int NOT NULL,
  `ma_nhan_vien` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_nhan_vien` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `trang_thai` enum('registered','checked_in','checked_out') COLLATE utf8mb4_unicode_ci DEFAULT 'registered',
  `gio_vao` time DEFAULT NULL,
  `gio_ra` time DEFAULT NULL,
  `thoi_gian_lam` decimal(5,2) DEFAULT NULL,
  `ghi_chu` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_schedule` (`ngay`,`ca`,`nhan_vien_id`),
  KEY `nhan_vien_id` (`nhan_vien_id`),
  KEY `idx_ngay` (`ngay`),
  KEY `idx_ca` (`ca`),
  KEY `idx_ma_nhan_vien` (`ma_nhan_vien`),
  CONSTRAINT `lich_truc_ibfk_1` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhanvien` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lich_truc`
--

LOCK TABLES `lich_truc` WRITE;
/*!40000 ALTER TABLE `lich_truc` DISABLE KEYS */;
/*!40000 ALTER TABLE `lich_truc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nhanvien`
--

DROP TABLE IF EXISTS `nhanvien`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nhanvien` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_nhan_vien` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_nhan_vien` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_admin` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_nhan_vien` (`ma_nhan_vien`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nhanvien`
--

LOCK TABLES `nhanvien` WRITE;
/*!40000 ALTER TABLE `nhanvien` DISABLE KEYS */;
INSERT INTO `nhanvien` VALUES (1,'admin','Quản trị viên hệ thống','$2b$10$J7A8fzh4uoyUTIPPRydllucZ2wRZBTBfMZlG33DnLJt10pZLP80Vu',1,'2026-03-07 06:36:11');
/*!40000 ALTER TABLE `nhanvien` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `thong_bao_truc_thay`
--

DROP TABLE IF EXISTS `thong_bao_truc_thay`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `thong_bao_truc_thay` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nguoi_nhan_id` int NOT NULL,
  `nguoi_gui_id` int NOT NULL,
  `lich_truc_id` int NOT NULL,
  `noi_dung` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `da_xem` tinyint(1) DEFAULT '0',
  `loai` enum('cancel','time_adjustment','time_adjustment_approved','time_adjustment_rejected','checkin_request','checkout_request') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nguoi_gui_id` (`nguoi_gui_id`),
  KEY `lich_truc_id` (`lich_truc_id`),
  KEY `idx_nguoi_nhan` (`nguoi_nhan_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `thong_bao_truc_thay_ibfk_1` FOREIGN KEY (`nguoi_nhan_id`) REFERENCES `nhanvien` (`id`) ON DELETE CASCADE,
  CONSTRAINT `thong_bao_truc_thay_ibfk_2` FOREIGN KEY (`nguoi_gui_id`) REFERENCES `nhanvien` (`id`) ON DELETE CASCADE,
  CONSTRAINT `thong_bao_truc_thay_ibfk_3` FOREIGN KEY (`lich_truc_id`) REFERENCES `lich_truc` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `thong_bao_truc_thay`
--

LOCK TABLES `thong_bao_truc_thay` WRITE;
/*!40000 ALTER TABLE `thong_bao_truc_thay` DISABLE KEYS */;
/*!40000 ALTER TABLE `thong_bao_truc_thay` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `truc_thay`
--

DROP TABLE IF EXISTS `truc_thay`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `truc_thay` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lich_truc_goc_id` int NOT NULL,
  `nguoi_dang_ky_id` int NOT NULL,
  `nguoi_thuc_hien_id` int NOT NULL,
  `lich_truc_ao_id` int DEFAULT NULL,
  `ly_do` text COLLATE utf8mb4_unicode_ci,
  `trang_thai` enum('pending','active','completed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_truc_thay` (`lich_truc_goc_id`),
  KEY `lich_truc_ao_id` (`lich_truc_ao_id`),
  KEY `idx_nguoi_dang_ky` (`nguoi_dang_ky_id`),
  KEY `idx_nguoi_thuc_hien` (`nguoi_thuc_hien_id`),
  CONSTRAINT `truc_thay_ibfk_1` FOREIGN KEY (`lich_truc_goc_id`) REFERENCES `lich_truc` (`id`) ON DELETE CASCADE,
  CONSTRAINT `truc_thay_ibfk_2` FOREIGN KEY (`nguoi_dang_ky_id`) REFERENCES `nhanvien` (`id`) ON DELETE CASCADE,
  CONSTRAINT `truc_thay_ibfk_3` FOREIGN KEY (`nguoi_thuc_hien_id`) REFERENCES `nhanvien` (`id`) ON DELETE CASCADE,
  CONSTRAINT `truc_thay_ibfk_4` FOREIGN KEY (`lich_truc_ao_id`) REFERENCES `lich_truc` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `truc_thay`
--

LOCK TABLES `truc_thay` WRITE;
/*!40000 ALTER TABLE `truc_thay` DISABLE KEYS */;
/*!40000 ALTER TABLE `truc_thay` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `v_current_working_shifts`
--

DROP TABLE IF EXISTS `v_current_working_shifts`;
/*!50001 DROP VIEW IF EXISTS `v_current_working_shifts`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_current_working_shifts` AS SELECT 
 1 AS `ngay`,
 1 AS `ca`,
 1 AS `ma_nhan_vien`,
 1 AS `ten_nhan_vien`,
 1 AS `gio_vao`,
 1 AS `thoi_gian_da_lam`,
 1 AS `thoi_gian_da_lam_formatted`,
 1 AS `trang_thai_truc_thay`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_daily_shifts_summary`
--

DROP TABLE IF EXISTS `v_daily_shifts_summary`;
/*!50001 DROP VIEW IF EXISTS `v_daily_shifts_summary`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_daily_shifts_summary` AS SELECT 
 1 AS `ngay`,
 1 AS `ca`,
 1 AS `so_luong_nguoi`,
 1 AS `danh_sach_nhan_vien`,
 1 AS `tong_gio_lam`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_monthly_employee_stats`
--

DROP TABLE IF EXISTS `v_monthly_employee_stats`;
/*!50001 DROP VIEW IF EXISTS `v_monthly_employee_stats`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_monthly_employee_stats` AS SELECT 
 1 AS `ma_nhan_vien`,
 1 AS `ten_nhan_vien`,
 1 AS `nam`,
 1 AS `thang`,
 1 AS `tong_so_ca_dang_ky`,
 1 AS `so_ca_hoan_thanh`,
 1 AS `so_ca_dang_lam`,
 1 AS `tong_gio_lam_chinh`,
 1 AS `tong_gio_truc_thay`,
 1 AS `tong_gio_lam_formatted`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_my_truc_thay_shifts`
--

DROP TABLE IF EXISTS `v_my_truc_thay_shifts`;
/*!50001 DROP VIEW IF EXISTS `v_my_truc_thay_shifts`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_my_truc_thay_shifts` AS SELECT 
 1 AS `truc_thay_id`,
 1 AS `nguoi_thuc_hien_id`,
 1 AS `ma_nguoi_thuc_hien`,
 1 AS `ten_nguoi_thuc_hien`,
 1 AS `nguoi_dang_ky_id`,
 1 AS `ma_nguoi_dang_ky`,
 1 AS `ten_nguoi_dang_ky`,
 1 AS `lich_truc_goc_id`,
 1 AS `ngay`,
 1 AS `ca`,
 1 AS `trang_thai_ca_goc`,
 1 AS `gio_vao_goc`,
 1 AS `gio_ra_goc`,
 1 AS `thoi_gian_lam_goc`,
 1 AS `lich_truc_ao_id`,
 1 AS `trang_thai_ca_ao`,
 1 AS `gio_vao_ao`,
 1 AS `gio_ra_ao`,
 1 AS `thoi_gian_lam_ao`,
 1 AS `ly_do`,
 1 AS `trang_thai_truc_thay`,
 1 AS `created_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_thong_bao_truc_thay`
--

DROP TABLE IF EXISTS `v_thong_bao_truc_thay`;
/*!50001 DROP VIEW IF EXISTS `v_thong_bao_truc_thay`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_thong_bao_truc_thay` AS SELECT 
 1 AS `id`,
 1 AS `nguoi_nhan_id`,
 1 AS `ma_nguoi_nhan`,
 1 AS `ten_nguoi_nhan`,
 1 AS `nguoi_gui_id`,
 1 AS `ma_nguoi_gui`,
 1 AS `ten_nguoi_gui`,
 1 AS `lich_truc_id`,
 1 AS `ngay`,
 1 AS `ca`,
 1 AS `noi_dung`,
 1 AS `da_xem`,
 1 AS `loai`,
 1 AS `created_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_truc_thay_detail`
--

DROP TABLE IF EXISTS `v_truc_thay_detail`;
/*!50001 DROP VIEW IF EXISTS `v_truc_thay_detail`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_truc_thay_detail` AS SELECT 
 1 AS `id`,
 1 AS `lich_truc_goc_id`,
 1 AS `lich_truc_ao_id`,
 1 AS `ngay`,
 1 AS `ca`,
 1 AS `nguoi_dang_ky_id`,
 1 AS `ma_nguoi_dang_ky`,
 1 AS `ten_nguoi_dang_ky`,
 1 AS `nguoi_thuc_hien_id`,
 1 AS `ma_nguoi_thuc_hien`,
 1 AS `ten_nguoi_thuc_hien`,
 1 AS `ly_do`,
 1 AS `trang_thai_truc_thay`,
 1 AS `created_at`,
 1 AS `updated_at`,
 1 AS `trang_thai_ca_goc`,
 1 AS `gio_vao_goc`,
 1 AS `gio_ra_goc`,
 1 AS `thoi_gian_lam_goc`,
 1 AS `trang_thai_ca_ao`,
 1 AS `gio_vao_ao`,
 1 AS `gio_ra_ao`,
 1 AS `thoi_gian_lam_ao`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `yeu_cau_dieu_chinh_gio`
--

DROP TABLE IF EXISTS `yeu_cau_dieu_chinh_gio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `yeu_cau_dieu_chinh_gio` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lich_truc_id` int NOT NULL,
  `nhan_vien_id` int NOT NULL,
  `ma_nhan_vien` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_nhan_vien` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `loai_yeu_cau` enum('checkin','checkout') COLLATE utf8mb4_unicode_ci NOT NULL,
  `thoi_gian_de_xuat` time NOT NULL,
  `gio_vao_hien_tai` time DEFAULT NULL,
  `gio_ra_hien_tai` time DEFAULT NULL,
  `ngay` date NOT NULL,
  `ca` enum('ca1','ca2','ca3','ca4') COLLATE utf8mb4_unicode_ci NOT NULL,
  `ly_do` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `trang_thai` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `admin_duyet_id` int DEFAULT NULL,
  `ghi_chu_admin` text COLLATE utf8mb4_unicode_ci,
  `thoi_gian_dieu_chinh` time DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `lich_truc_id` (`lich_truc_id`),
  KEY `admin_duyet_id` (`admin_duyet_id`),
  KEY `idx_trang_thai` (`trang_thai`),
  KEY `idx_nhan_vien` (`nhan_vien_id`),
  KEY `idx_ngay` (`ngay`),
  KEY `idx_loai_yeu_cau` (`loai_yeu_cau`),
  CONSTRAINT `yeu_cau_dieu_chinh_gio_ibfk_1` FOREIGN KEY (`lich_truc_id`) REFERENCES `lich_truc` (`id`) ON DELETE CASCADE,
  CONSTRAINT `yeu_cau_dieu_chinh_gio_ibfk_2` FOREIGN KEY (`nhan_vien_id`) REFERENCES `nhanvien` (`id`) ON DELETE CASCADE,
  CONSTRAINT `yeu_cau_dieu_chinh_gio_ibfk_3` FOREIGN KEY (`admin_duyet_id`) REFERENCES `nhanvien` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `yeu_cau_dieu_chinh_gio`
--

LOCK TABLES `yeu_cau_dieu_chinh_gio` WRITE;
/*!40000 ALTER TABLE `yeu_cau_dieu_chinh_gio` DISABLE KEYS */;
/*!40000 ALTER TABLE `yeu_cau_dieu_chinh_gio` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Final view structure for view `v_current_working_shifts`
--

/*!50001 DROP VIEW IF EXISTS `v_current_working_shifts`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_current_working_shifts` AS select `lt`.`ngay` AS `ngay`,`lt`.`ca` AS `ca`,`lt`.`ma_nhan_vien` AS `ma_nhan_vien`,`lt`.`ten_nhan_vien` AS `ten_nhan_vien`,`lt`.`gio_vao` AS `gio_vao`,timediff(curtime(),`lt`.`gio_vao`) AS `thoi_gian_da_lam`,time_format(timediff(curtime(),`lt`.`gio_vao`),'%H giờ %i phút') AS `thoi_gian_da_lam_formatted`,(case when (`tt`.`id` is not null) then concat('Trực thay cho: ',`nv`.`ten_nhan_vien`) else 'Tự trực' end) AS `trang_thai_truc_thay` from ((`lich_truc` `lt` left join `truc_thay` `tt` on((`lt`.`id` = `tt`.`lich_truc_goc_id`))) left join `nhanvien` `nv` on((`tt`.`nguoi_dang_ky_id` = `nv`.`id`))) where ((`lt`.`ngay` = curdate()) and (`lt`.`trang_thai` = 'checked_in')) order by `lt`.`ca`,`lt`.`gio_vao` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_daily_shifts_summary`
--

/*!50001 DROP VIEW IF EXISTS `v_daily_shifts_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_daily_shifts_summary` AS select `lich_truc`.`ngay` AS `ngay`,`lich_truc`.`ca` AS `ca`,count(0) AS `so_luong_nguoi`,group_concat(`lich_truc`.`ten_nhan_vien` order by `lich_truc`.`ten_nhan_vien` ASC separator ', ') AS `danh_sach_nhan_vien`,sum((case when (`lich_truc`.`trang_thai` = 'checked_out') then `lich_truc`.`thoi_gian_lam` else 0 end)) AS `tong_gio_lam` from `lich_truc` group by `lich_truc`.`ngay`,`lich_truc`.`ca` order by `lich_truc`.`ngay` desc,`lich_truc`.`ca` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_monthly_employee_stats`
--

/*!50001 DROP VIEW IF EXISTS `v_monthly_employee_stats`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_monthly_employee_stats` AS select `nv`.`ma_nhan_vien` AS `ma_nhan_vien`,`nv`.`ten_nhan_vien` AS `ten_nhan_vien`,year(`lt`.`ngay`) AS `nam`,month(`lt`.`ngay`) AS `thang`,count(distinct `lt`.`id`) AS `tong_so_ca_dang_ky`,sum((case when (`lt`.`trang_thai` = 'checked_out') then 1 else 0 end)) AS `so_ca_hoan_thanh`,sum((case when (`lt`.`trang_thai` = 'checked_in') then 1 else 0 end)) AS `so_ca_dang_lam`,coalesce(sum(`lt`.`thoi_gian_lam`),0) AS `tong_gio_lam_chinh`,coalesce((select sum(`lt2`.`thoi_gian_lam`) from (`truc_thay` `tt2` join `lich_truc` `lt2` on((`tt2`.`lich_truc_goc_id` = `lt2`.`id`))) where ((`tt2`.`nguoi_thuc_hien_id` = `nv`.`id`) and (`lt2`.`trang_thai` = 'checked_out') and (year(`lt2`.`ngay`) = year(`lt`.`ngay`)) and (month(`lt2`.`ngay`) = month(`lt`.`ngay`)))),0) AS `tong_gio_truc_thay`,`format_hours`((coalesce(sum(`lt`.`thoi_gian_lam`),0) + coalesce((select sum(`lt2`.`thoi_gian_lam`) from (`truc_thay` `tt2` join `lich_truc` `lt2` on((`tt2`.`lich_truc_goc_id` = `lt2`.`id`))) where ((`tt2`.`nguoi_thuc_hien_id` = `nv`.`id`) and (`lt2`.`trang_thai` = 'checked_out') and (year(`lt2`.`ngay`) = year(`lt`.`ngay`)) and (month(`lt2`.`ngay`) = month(`lt`.`ngay`)))),0))) AS `tong_gio_lam_formatted` from (`nhanvien` `nv` left join `lich_truc` `lt` on((`nv`.`id` = `lt`.`nhan_vien_id`))) group by `nv`.`id`,`nv`.`ma_nhan_vien`,`nv`.`ten_nhan_vien`,year(`lt`.`ngay`),month(`lt`.`ngay`) order by `nam` desc,`thang` desc,`tong_gio_lam_chinh` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_my_truc_thay_shifts`
--

/*!50001 DROP VIEW IF EXISTS `v_my_truc_thay_shifts`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_my_truc_thay_shifts` AS select `tt`.`id` AS `truc_thay_id`,`tt`.`nguoi_thuc_hien_id` AS `nguoi_thuc_hien_id`,`nv_thuc_hien`.`ma_nhan_vien` AS `ma_nguoi_thuc_hien`,`nv_thuc_hien`.`ten_nhan_vien` AS `ten_nguoi_thuc_hien`,`tt`.`nguoi_dang_ky_id` AS `nguoi_dang_ky_id`,`nv_dang_ky`.`ma_nhan_vien` AS `ma_nguoi_dang_ky`,`nv_dang_ky`.`ten_nhan_vien` AS `ten_nguoi_dang_ky`,`tt`.`lich_truc_goc_id` AS `lich_truc_goc_id`,`lt_goc`.`ngay` AS `ngay`,`lt_goc`.`ca` AS `ca`,`lt_goc`.`trang_thai` AS `trang_thai_ca_goc`,`lt_goc`.`gio_vao` AS `gio_vao_goc`,`lt_goc`.`gio_ra` AS `gio_ra_goc`,`lt_goc`.`thoi_gian_lam` AS `thoi_gian_lam_goc`,`tt`.`lich_truc_ao_id` AS `lich_truc_ao_id`,`lt_ao`.`trang_thai` AS `trang_thai_ca_ao`,`lt_ao`.`gio_vao` AS `gio_vao_ao`,`lt_ao`.`gio_ra` AS `gio_ra_ao`,`lt_ao`.`thoi_gian_lam` AS `thoi_gian_lam_ao`,`tt`.`ly_do` AS `ly_do`,`tt`.`trang_thai` AS `trang_thai_truc_thay`,`tt`.`created_at` AS `created_at` from ((((`truc_thay` `tt` join `lich_truc` `lt_goc` on((`tt`.`lich_truc_goc_id` = `lt_goc`.`id`))) left join `lich_truc` `lt_ao` on((`tt`.`lich_truc_ao_id` = `lt_ao`.`id`))) join `nhanvien` `nv_thuc_hien` on((`tt`.`nguoi_thuc_hien_id` = `nv_thuc_hien`.`id`))) join `nhanvien` `nv_dang_ky` on((`tt`.`nguoi_dang_ky_id` = `nv_dang_ky`.`id`))) order by `lt_goc`.`ngay` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_thong_bao_truc_thay`
--

/*!50001 DROP VIEW IF EXISTS `v_thong_bao_truc_thay`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_thong_bao_truc_thay` AS select `tb`.`id` AS `id`,`tb`.`nguoi_nhan_id` AS `nguoi_nhan_id`,`nv_nhan`.`ma_nhan_vien` AS `ma_nguoi_nhan`,`nv_nhan`.`ten_nhan_vien` AS `ten_nguoi_nhan`,`tb`.`nguoi_gui_id` AS `nguoi_gui_id`,`nv_gui`.`ma_nhan_vien` AS `ma_nguoi_gui`,`nv_gui`.`ten_nhan_vien` AS `ten_nguoi_gui`,`tb`.`lich_truc_id` AS `lich_truc_id`,`lt`.`ngay` AS `ngay`,`lt`.`ca` AS `ca`,`tb`.`noi_dung` AS `noi_dung`,`tb`.`da_xem` AS `da_xem`,`tb`.`loai` AS `loai`,`tb`.`created_at` AS `created_at` from (((`thong_bao_truc_thay` `tb` join `nhanvien` `nv_nhan` on((`tb`.`nguoi_nhan_id` = `nv_nhan`.`id`))) join `nhanvien` `nv_gui` on((`tb`.`nguoi_gui_id` = `nv_gui`.`id`))) join `lich_truc` `lt` on((`tb`.`lich_truc_id` = `lt`.`id`))) order by `tb`.`created_at` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_truc_thay_detail`
--

/*!50001 DROP VIEW IF EXISTS `v_truc_thay_detail`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_truc_thay_detail` AS select `tt`.`id` AS `id`,`tt`.`lich_truc_goc_id` AS `lich_truc_goc_id`,`tt`.`lich_truc_ao_id` AS `lich_truc_ao_id`,`lt_goc`.`ngay` AS `ngay`,`lt_goc`.`ca` AS `ca`,`nv1`.`id` AS `nguoi_dang_ky_id`,`nv1`.`ma_nhan_vien` AS `ma_nguoi_dang_ky`,`nv1`.`ten_nhan_vien` AS `ten_nguoi_dang_ky`,`nv2`.`id` AS `nguoi_thuc_hien_id`,`nv2`.`ma_nhan_vien` AS `ma_nguoi_thuc_hien`,`nv2`.`ten_nhan_vien` AS `ten_nguoi_thuc_hien`,`tt`.`ly_do` AS `ly_do`,`tt`.`trang_thai` AS `trang_thai_truc_thay`,`tt`.`created_at` AS `created_at`,`tt`.`updated_at` AS `updated_at`,`lt_goc`.`trang_thai` AS `trang_thai_ca_goc`,`lt_goc`.`gio_vao` AS `gio_vao_goc`,`lt_goc`.`gio_ra` AS `gio_ra_goc`,`lt_goc`.`thoi_gian_lam` AS `thoi_gian_lam_goc`,`lt_ao`.`trang_thai` AS `trang_thai_ca_ao`,`lt_ao`.`gio_vao` AS `gio_vao_ao`,`lt_ao`.`gio_ra` AS `gio_ra_ao`,`lt_ao`.`thoi_gian_lam` AS `thoi_gian_lam_ao` from ((((`truc_thay` `tt` join `lich_truc` `lt_goc` on((`tt`.`lich_truc_goc_id` = `lt_goc`.`id`))) left join `lich_truc` `lt_ao` on((`tt`.`lich_truc_ao_id` = `lt_ao`.`id`))) join `nhanvien` `nv1` on((`tt`.`nguoi_dang_ky_id` = `nv1`.`id`))) join `nhanvien` `nv2` on((`tt`.`nguoi_thuc_hien_id` = `nv2`.`id`))) order by `tt`.`created_at` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-07 13:38:12
