package cn.openlims.platform.recruitment.form.repository;

import cn.openlims.platform.recruitment.form.model.RecruitmentFormVersionEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecruitmentFormVersionRepository extends JpaRepository<RecruitmentFormVersionEntity, UUID> { }
