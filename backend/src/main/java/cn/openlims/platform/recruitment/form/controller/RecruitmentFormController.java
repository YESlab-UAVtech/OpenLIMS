package cn.openlims.platform.recruitment.form.controller;

import cn.openlims.platform.common.api.ApiResponse;
import cn.openlims.platform.recruitment.form.api.RecruitmentFormModels.ApplicantView;
import cn.openlims.platform.recruitment.form.service.RecruitmentFormService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/recruitment/me/form")
public class RecruitmentFormController {
    private final RecruitmentFormService service;
    public RecruitmentFormController(RecruitmentFormService service) { this.service = service; }
    @GetMapping public ApiResponse<ApplicantView> form(Authentication authentication) {
        return ApiResponse.ok(service.ownForm(authentication));
    }
}
