#version 330


in vec2 fragTexCoord;
in vec4 fragColor;


uniform sampler2D texture0;
uniform vec4 colDiffuse;
uniform float bloomIntensity;


out vec4 finalColor;

#define colorRange 24.0


vec3 jodieReinhardTonemap(vec3 c){
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 tc = c / (c + 1.0);
    return mix(c / (l + 1.0), tc, tc);
}


vec3 getBloom(vec2 uv){
    vec3 blur = vec3(0.0);
    vec2 texelSize = 1.0 / textureSize(texture0, 0);
    

    float weights[8] = float[8](0.20, 0.17, 0.14, 0.11, 0.08, 0.05, 0.03, 0.01);
    

    float baseRadius = bloomIntensity * 2.0;
    

    blur += texture(texture0, uv).rgb * weights[0];
    

    for(int ring = 1; ring < 8; ring++) {
        float radius = baseRadius * (0.3 + float(ring) * 0.2); 
        int samples = 4 + ring * 2; 
        
        for(int i = 0; i < samples; i++) {
            float angle = (float(i) / float(samples)) * 6.283185307; 
            vec2 offset = vec2(cos(angle), sin(angle)) * texelSize * radius;
            blur += texture(texture0, uv + offset).rgb * weights[ring];
        }
    }
    

    blur /= 3.0; 
    
    return blur;
}

void main()
{
    vec2 uv = fragTexCoord;
    

    vec3 original = texture(texture0, uv).rgb;
    

    vec3 bloom = getBloom(uv) * bloomIntensity * 0.3;
    

    vec3 result = original + bloom;
    
    finalColor = vec4(result, texture(texture0, uv).a) * colDiffuse;
}